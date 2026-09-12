import { NextResponse } from "next/server";
import { assertRole, errorResponse, getSessionProfile, HttpError } from "@/lib/auth";
import { getBookingOr404, withTimeline } from "@/lib/booking-service.server";
import { computeFinancials } from "@/lib/bookings";
import { toServiceRows } from "@/lib/booking-actions";
import {
  availableChannels,
  buildConfirmationText,
  sendEmail,
  sendWhatsApp,
  type Channel,
  type ConfirmationInput,
} from "@/lib/notify";
import type { Booking } from "@/lib/types";

function payload(booking: Booking): ConfirmationInput {
  const rows = toServiceRows(booking);
  const fin = computeFinancials(booking as never);
  return {
    bookingNumber: booking.booking_number,
    customerName: booking.customer_snapshot?.name ?? "",
    destination: booking.destination,
    travelStart: booking.travel_start_date,
    travelEnd: booking.travel_end_date,
    pax: booking.num_travellers ?? 1,
    lines: rows.map((r) => ({
      kind: r.kind,
      title: r.title,
      date: r.date,
      detail: r.detail,
      city: r.city,
      status: r.status,
    })),
    total: fin.total_sales,
  };
}

// Preview plus the list of available channels
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");

    const booking = (await getBookingOr404(supabase, params.id)) as Booking;
    return NextResponse.json({
      channels: availableChannels(),
      message: buildConfirmationText(payload(booking)),
      email: booking.customer_snapshot?.email ?? "",
      mobile: booking.customer_snapshot?.mobile ?? booking.booker_mobile ?? "",
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");
    assertRole(profile.role, ["sales", "operations"]);

    const body = (await req.json()) as {
      channels?: Channel[];
      email?: string;
      mobile?: string;
      message?: string;
    };

    const channels = body.channels ?? [];
    if (channels.length === 0) throw new HttpError(400, "Select at least one channel");

    const booking = (await getBookingOr404(supabase, params.id)) as Booking;
    const text = (body.message ?? "").trim() || buildConfirmationText(payload(booking));

    const results = [];
    if (channels.includes("email")) {
      const to = (body.email ?? booking.customer_snapshot?.email ?? "").trim();
      if (!to) results.push({ channel: "email" as Channel, ok: false, detail: "No email address on file" });
      else results.push(await sendEmail(to, `Booking ${booking.booking_number} — Confirmation`, text, booking.booking_number));
    }
    if (channels.includes("whatsapp")) {
      const to = (body.mobile ?? booking.customer_snapshot?.mobile ?? "").trim();
      if (!to) results.push({ channel: "whatsapp" as Channel, ok: false, detail: "No mobile number on file" });
      else results.push(await sendWhatsApp(to, text));
    }

    const sent = results.filter((r) => r.ok);
    if (sent.length > 0) {
      await supabase
        .from("bookings")
        .update({
          status: booking.status === "Enquiry" ? "Booking Requested" : booking.status,
          timeline: withTimeline(
            booking.timeline,
            profile.name || profile.email || "system",
            `Confirmation sent via ${sent.map((r) => r.channel).join(", ")}`,
          ),
        })
        .eq("id", params.id);
    }

    return NextResponse.json({ results, anySent: sent.length > 0 });
  } catch (e) {
    return errorResponse(e);
  }
}
