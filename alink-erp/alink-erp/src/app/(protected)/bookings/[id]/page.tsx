import { redirect, notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { computeFinancials, redactForRole, numPaxOf } from "@/lib/bookings";
import BookingDetailClient from "@/components/bookings/booking-detail-client";
import type { Booking } from "@/lib/types";

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  const { data } = await supabase.from("bookings").select("*").eq("id", params.id).single();
  if (!data) notFound();

  const booking = redactForRole(
    { ...(data as Booking), financials: computeFinancials(data as Booking) },
    profile.role
  ) as Booking;

  const canEdit = ["admin", "super_admin", "sales", "operations"].includes(profile.role);
  return (
    <BookingDetailClient
      initial={booking}
      role={profile.role}
      canEdit={canEdit}
      numPax={numPaxOf(booking)}
    />
  );
}
