import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, errorResponse } from "@/lib/auth";
import { computeFinancials, redactForRole } from "@/lib/bookings";

type Ctx = { params: { id: string } };

// GET /api/bookings/:id — single booking with computed financials.
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: b, error } = await supabase.from("bookings").select("*").eq("id", params.id).single();
    if (error || !b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const withFin = { ...b, financials: computeFinancials(b) };
    return NextResponse.json(redactForRole(withFin, profile.role));
  } catch (e) {
    return errorResponse(e);
  }
}
