import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { computeFinancials, redactForRole } from "@/lib/bookings";
import { BookingDetailView } from "@/components/bookings/booking-detail-view";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

// Next.js 14 â€” params seedha object hai, Promise nahi.
export default async function BookingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const { user, profile, supabase } = await getSessionProfile();

  if (!user || !profile) redirect("/login");
  if (!profile.active) redirect("/inactive");

  // RLS already tenant ke hisaab se filter kar deta hai.
  const { data } = await supabase.from("bookings").select("*").eq("id", id).single();
  if (!data) notFound();

  const booking = redactForRole(
    { ...data, financials: computeFinancials(data) },
    profile.role,
  ) as Booking;

  return (
    <BookingDetailView
      booking={booking}
      role={profile.role}
      demoExpiresOn={process.env.NEXT_PUBLIC_DEMO_EXPIRES_ON ?? null}
    />
  );
}