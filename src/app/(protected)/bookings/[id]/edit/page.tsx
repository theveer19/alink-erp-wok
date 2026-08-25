import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { computeFinancials, redactForRole } from "@/lib/bookings";
import { BookingEditView } from "@/components/bookings/booking-edit-view";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BookingEditPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { user, profile, supabase } = await getSessionProfile();

  if (!user || !profile) redirect("/login");
  if (!profile.active) redirect("/inactive");
  if (profile.role === "accounts") redirect(`/bookings/${id}`);

  const { data } = await supabase.from("bookings").select("*").eq("id", id).single();
  if (!data) notFound();

  const booking = redactForRole({ ...data, financials: computeFinancials(data) }, profile.role) as Booking;

  return <BookingEditView booking={booking} role={profile.role} />;
}
