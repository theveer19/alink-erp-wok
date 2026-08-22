import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, assertRole, errorResponse } from "@/lib/auth";
import {
  computeFinancials, redactForRole, recomputeService, numPaxOf,
  SERVICE_KEY, SUPPLIER_FIELDS,
} from "@/lib/bookings";
import { getBookingOr404, assertNotInvoiceLocked, withTimeline } from "@/lib/booking-service.server";

type Ctx = { params: { id: string; stype: string; sid: string } };

// PUT  -> edit a service
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    assertRole(profile.role, ["sales", "operations"]);

    const key = SERVICE_KEY[params.stype];
    if (!key) return NextResponse.json({ error: "Invalid service type" }, { status: 400 });

    const b = await getBookingOr404(supabase, params.id);
    await assertNotInvoiceLocked(supabase, params.id, profile.role);

    const arr = (Array.isArray(b[key]) ? b[key] : []) as Record<string, unknown>[];
    const idx = arr.findIndex((s) => s.sid === params.sid);
    if (idx === -1) return NextResponse.json({ error: "Service not found" }, { status: 404 });

    const patch: Record<string, unknown> = { ...(await req.json()) };
    delete patch.sid;
    const ratesLocked = !!b.rates_locked;
    if (profile.role === "sales" || (ratesLocked && profile.role !== "admin")) {
      for (const f of SUPPLIER_FIELDS) delete patch[f];
    }

    const merged = recomputeService({ ...arr[idx], ...patch }, numPaxOf(b));
    const nextArr = arr.map((s, i) => (i === idx ? merged : s));

    const { data: updated, error } = await supabase
      .from("bookings")
      .update({ [key]: nextArr, timeline: withTimeline(b.timeline, profile.name, `${cap(params.stype)} service updated`) })
      .eq("id", params.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(redactForRole({ ...updated, financials: computeFinancials(updated) }, profile.role));
  } catch (e) {
    return errorResponse(e);
  }
}

// DELETE -> remove a service
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    assertRole(profile.role, ["sales", "operations"]);

    const key = SERVICE_KEY[params.stype];
    if (!key) return NextResponse.json({ error: "Invalid service type" }, { status: 400 });

    const b = await getBookingOr404(supabase, params.id);
    await assertNotInvoiceLocked(supabase, params.id, profile.role);

    const arr = (Array.isArray(b[key]) ? b[key] : []) as Record<string, unknown>[];
    const nextArr = arr.filter((s) => s.sid !== params.sid);

    const { data: updated, error } = await supabase
      .from("bookings")
      .update({ [key]: nextArr, timeline: withTimeline(b.timeline, profile.name, `${cap(params.stype)} service removed`) })
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
