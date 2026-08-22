import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, assertRole, errorResponse } from "@/lib/auth";
import { getBookingOr404, withTimeline, bookingResponse } from "@/lib/booking-service.server";

type Ctx = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    assertRole(profile.role, ["operations"]);

    const b = await getBookingOr404(supabase, params.id);
    const { error } = await supabase
      .from("bookings")
      .update({ rates_locked: true, timeline: withTimeline(b.timeline, profile.name, "Supplier rates locked") })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(await bookingResponse(supabase, params.id, profile.role));
  } catch (e) {
    return errorResponse(e);
  }
}
