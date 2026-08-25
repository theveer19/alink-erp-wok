import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole, errorResponse, getSessionProfile, HttpError } from "@/lib/auth";
import { getBookingOr404, withTimeline } from "@/lib/booking-service.server";

const Body = z.object({
  type: z.enum(["customer", "supplier"]).default("customer"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  mode: z.string().max(40).optional(),
  reference: z.string().max(80).optional(),
  remarks: z.string().max(300).optional(),
  date: z.string().max(30).optional(),
  supplier_id: z.string().uuid().nullable().optional(),
});

// All payments on this booking
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");
    assertRole(profile.role, ["accounts", "operations"]);

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("booking_id", params.id)
      .order("date", { ascending: false });
    if (error) throw new HttpError(500, error.message);

    return NextResponse.json({ payments: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}

// Record an advance receipt or a supplier payment
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");
    assertRole(profile.role, ["accounts"]);

    const body = Body.parse(await req.json());
    const booking = await getBookingOr404(supabase, params.id);
    const actor = profile.name || profile.email || "system";

    if (body.type === "supplier" && !body.supplier_id) {
      throw new HttpError(400, "Select a supplier for a supplier payment");
    }

    const { data, error } = await supabase
      .from("payments")
      .insert({
        tenant_id: profile.tenant_id,
        type: body.type,
        booking_id: params.id,
        invoice_id: booking.invoice_id ?? null,
        supplier_id: body.type === "supplier" ? body.supplier_id : null,
        amount: body.amount,
        mode: body.mode ?? null,
        reference: body.reference ?? null,
        remarks: body.remarks ?? null,
        date: body.date || new Date().toISOString().slice(0, 10),
        recorded_by: actor,
      })
      .select("*")
      .single();
    if (error) throw new HttpError(500, error.message);

    // If an invoice is linked, update received / balance on it.
    if (body.type === "customer" && booking.invoice_id) {
      const { data: inv } = await supabase
        .from("invoices")
        .select("grand_total, amount_received")
        .eq("id", booking.invoice_id)
        .single();
      if (inv) {
        const received = Number(inv.amount_received || 0) + body.amount;
        const balance = Math.max(0, Number(inv.grand_total || 0) - received);
        await supabase
          .from("invoices")
          .update({
            amount_received: received,
            balance_due: balance,
            status: balance === 0 ? "Paid" : received > 0 ? "Partially Paid" : "Unpaid",
          })
          .eq("id", booking.invoice_id);
      }
    }

    await supabase
      .from("bookings")
      .update({
        payment_status: body.type === "customer" ? "Partially Paid" : booking.payment_status,
        timeline: withTimeline(
          booking.timeline,
          actor,
          `${body.type === "customer" ? "Advance received" : "Supplier paid"}: ${body.amount}${
            body.mode ? ` (${body.mode})` : ""
          }`,
        ),
      })
      .eq("id", params.id);

    return NextResponse.json({ payment: data });
  } catch (e) {
    return errorResponse(e);
  }
}
