import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, errorResponse } from "@/lib/auth";
import { BOOKING_STATUSES } from "@/lib/bookings";
import { getBookingOr404, withTimeline, bookingResponse } from "@/lib/booking-service.server";

type Ctx = { params: { id: string } };
const ACCOUNTS_ALLOWED = ["Payment Pending", "Payment Received", "Invoice Generated"];

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { status } = await req.json();
    if (!BOOKING_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (profile.role === "accounts" && !ACCOUNTS_ALLOWED.includes(status)) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const b = await getBookingOr404(supabase, params.id);
    const upd: Record<string, unknown> = {
      status,
      timeline: withTimeline(b.timeline, profile.name, `Status changed to ${status}`),
    };
    if (!b.operations_executive_id && profile.role === "operations") {
      upd.operations_executive_id = profile.id;
      upd.operations_executive_name = profile.name;
    }
    const { error } = await supabase.from("bookings").update(upd).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(await bookingResponse(supabase, params.id, profile.role));
  } catch (e) {
    return errorResponse(e);
  }
}
