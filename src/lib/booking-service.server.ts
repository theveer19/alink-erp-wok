import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/auth";


export async function getBookingOr404(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("bookings").select("*").eq("id", id).single();
  if (error || !data) throw new HttpError(404, "Booking not found");
  return data;
}

// Block edits while an active (non-cancelled) invoice exists OR the booking is
// completed/closed. Admin/super_admin bypass (e.g. after reopening).
export async function assertNotInvoiceLocked(supabase: SupabaseClient, bookingId: string, role: string) {
  if (role === "admin" || role === "super_admin") return;

  const { data: bk } = await supabase.from("bookings").select("status").eq("id", bookingId).single();
  if (bk && (bk.status === "Completed" || bk.status === "Closed")) {
    throw new HttpError(423, "Booking is completed and locked. Reopen it to make changes.");
  }

  const { data } = await supabase
    .from("invoices")
    .select("invoice_number, status")
    .eq("booking_id", bookingId)
    .neq("status", "Cancelled")
    .maybeSingle();
  if (data) {
    throw new HttpError(423, `Booking is locked by active invoice ${data.invoice_number}. Clear the invoice to edit.`);
  }
}

export function withTimeline(
  timeline: unknown,
  by: string,
  action: string
): { at: string; by: string; action: string }[] {
  const list = Array.isArray(timeline) ? (timeline as { at: string; by: string; action: string }[]) : [];
  return [...list, { at: new Date().toISOString(), by, action }];
}

// Refetch a booking and return it with financials, redacted for the role.
import { computeFinancials, redactForRole } from "@/lib/bookings";

export async function bookingResponse(supabase: SupabaseClient, id: string, role: string) {
  const { data } = await supabase.from("bookings").select("*").eq("id", id).single();
  return redactForRole({ ...data, financials: computeFinancials(data) }, role);
}