import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, assertRole, errorResponse } from "@/lib/auth";
import { SERVICE_KEY } from "@/lib/bookings";
import { getBookingOr404, withTimeline, bookingResponse } from "@/lib/booking-service.server";

type Ctx = { params: { id: string; stype: string; sid: string } };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    assertRole(profile.role, ["operations"]);

    const key = SERVICE_KEY[params.stype];
    if (!key) return NextResponse.json({ error: "Invalid service type" }, { status: 400 });

    const b = await getBookingOr404(supabase, params.id);
    const arr = (Array.isArray(b[key]) ? b[key] : []) as Record<string, unknown>[];
    const nextArr = arr.map((s) => (s.sid === params.sid ? { ...s, confirmed: true } : s));

    const { error } = await supabase
      .from("bookings")
      .update({ [key]: nextArr, timeline: withTimeline(b.timeline, profile.name, `${params.stype} confirmed`) })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(await bookingResponse(supabase, params.id, profile.role));
  } catch (e) {
    return errorResponse(e);
  }
}
