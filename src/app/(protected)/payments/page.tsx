import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import PaymentsClient from "@/components/payments/payments-client";
import type { Payment } from "@/lib/types";

export default async function PaymentsPage() {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  const [{ data: payments }, { data: suppliers }, { data: bookings }] = await Promise.all([
    supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("bookings").select("id, booking_number").order("created_at", { ascending: false }).limit(1000),
  ]);

  const canRecord = ["accounts", "admin", "super_admin"].includes(profile.role);
  return (
    <PaymentsClient
      initial={(payments as Payment[]) ?? []}
      suppliers={(suppliers as { id: string; name: string }[]) ?? []}
      bookings={(bookings as { id: string; booking_number: string }[]) ?? []}
      canRecord={canRecord}
    />
  );
}
