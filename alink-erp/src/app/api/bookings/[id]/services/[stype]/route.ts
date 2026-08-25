import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, assertRole, errorResponse } from "@/lib/auth";
import {
  computeFinancials, redactForRole, recomputeService, numPaxOf,
  SERVICE_KEY, SUPPLIER_FIELDS,
} from "@/lib/bookings";
import { getBookingOr404, assertNotInvoiceLocked, withTimeline } from "@/lib/booking-service.server";

type Ctx = { params: { id: string; stype: string } };

// POST /api/bookings/:id/services/:stype  -> add a hotel/flight/other
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    assertRole(profile.role, ["sales", "operations"]);

    const key = SERVICE_KEY[params.stype];
    if (!key) return NextResponse.json({ error: "Invalid service type" }, { status: 400 });

    const b = await getBookingOr404(supabase, params.id);
    await assertNotInvoiceLocked(supabase, params.id, profile.role);

    const data: Record<string, unknown> = { ...(await req.json()) };
    if (profile.role === "sales") for (const f of SUPPLIER_FIELDS) delete data[f];

    const { data: seq, error: seqErr } = await supabase.rpc("next_seq", { p_name: "svc" });
    if (seqErr) return NextResponse.json({ error: seqErr.message }, { status: 500 });

    data.sid = `S${seq}`;
    data.confirmed = false;
    const computed = recomputeService(data, numPaxOf(b));

    const arr = Array.isArray(b[key]) ? (b[key] as unknown[]) : [];
    const nextArr = [...arr, computed];

    const { data: updated, error } = await supabase
      .from("bookings")
      .update({ [key]: nextArr, timeline: withTimeline(b.timeline, profile.name, `${cap(params.stype)} service added`) })
      .eq("id", params.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(redactForRole({ ...updated, financials: computeFinancials(updated) }, profile.role));
  } catch (e) {
    return errorResponse(e);
  }
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
