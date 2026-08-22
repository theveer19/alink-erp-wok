import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { computeFinancials, redactForRole } from "@/lib/bookings";
import BookingsClient from "@/components/bookings/bookings-client";
import type { Booking } from "@/lib/types";

export default async function BookingsPage() {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  let query = supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(2000);
  if (profile.role === "sales") query = query.eq("sales_executive_id", profile.id);
  const { data } = await query;

  const rows = ((data as Booking[]) ?? []).map((b) => {
    const withFin = { ...b, financials: computeFinancials(b) };
    return redactForRole(withFin, profile.role);
  });

  const canCreate = ["admin", "super_admin", "sales", "operations"].includes(profile.role);
  return <BookingsClient role={profile.role} canCreate={canCreate} initial={rows} />;
}
