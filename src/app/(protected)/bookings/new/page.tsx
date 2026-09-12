import { redirect } from "next/navigation";
import { getSessionProfile, assertRole } from "@/lib/auth";
import NewBookingClient from "@/components/bookings/new-booking-client";
import type { Customer, SupplierFull } from "@/lib/types";

export default async function NewBookingPage() {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");
  try {
    assertRole(profile.role, ["sales", "operations"]);
  } catch {
    redirect("/bookings");
  }

  const [{ data: customers }, { data: suppliers }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, company, mobile, email, gst_number, address, contact_person, hotel_service_charge, flight_service_charge")
      .order("name", { ascending: true })
      .limit(2000),
    supabase
      .from("suppliers")
      .select("id, name, supplier_type, default_rate")
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(2000),
  ]);

  return (
    <NewBookingClient
      bookerName={profile.name}
      customers={(customers as Customer[]) ?? []}
      suppliers={(suppliers as SupplierFull[]) ?? []}
    />
  );
}
