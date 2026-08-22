import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, assertRole, errorResponse } from "@/lib/auth";
import { bookingCreateSchema } from "@/lib/validators";
import { computeFinancials, redactForRole } from "@/lib/bookings";

const CUSTOMER_SNAPSHOT_FIELDS = ["name", "company", "contact_person", "mobile", "email", "address", "gst_number"] as const;

// GET /api/bookings — tenant-scoped, role-scoped (sales sees only own), with filters.
export async function GET(req: NextRequest) {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const rawQ = sp.get("q")?.trim() ?? "";
  const q = rawQ.replace(/[,()]/g, " ").trim();
  const status = sp.get("status")?.trim();
  const dateFrom = sp.get("date_from")?.trim();
  const dateTo = sp.get("date_to")?.trim();

  let query = supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(2000);

  if (profile.role === "sales") query = query.eq("sales_executive_id", profile.id);
  if (status && status !== "all") query = query.eq("status", status);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59Z`);
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `booking_number.ilike.${like},destination.ilike.${like},sales_executive_name.ilike.${like},booked_by.ilike.${like}`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out = (data ?? []).map((b) => {
    const withFin = { ...b, financials: computeFinancials(b) };
    return redactForRole(withFin, profile.role);
  });
  return NextResponse.json(out);
}

// POST /api/bookings — create (sales / operations / admin).
export async function POST(req: NextRequest) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    assertRole(profile.role, ["sales", "operations"]);

    const body = bookingCreateSchema.parse(await req.json());

    // 1) resolve or create the customer
    let customerId = body.customer_id ?? null;
    let snapshot: Record<string, unknown> = { ...(body.customer ?? {}) };

    if (customerId) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).single();
      if (c) {
        const base: Record<string, unknown> = {};
        for (const f of CUSTOMER_SNAPSHOT_FIELDS) base[f] = c[f] ?? null;
        snapshot = { ...base, ...snapshot };
      }
    } else {
      const { data: created, error: cErr } = await supabase
        .from("customers")
        .insert({ ...body.customer, tenant_id: profile.tenant_id, created_by: profile.name })
        .select()
        .single();
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
      customerId = created.id;
    }

    // 2) per-tenant booking number via next_seq()
    const { data: seq, error: seqErr } = await supabase.rpc("next_seq", { p_name: "booking" });
    if (seqErr) return NextResponse.json({ error: seqErr.message }, { status: 500 });

    const { data: settings } = await supabase
      .from("company_settings")
      .select("booking_prefix")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    const prefix = settings?.booking_prefix || "MT";
    const year = new Date().getFullYear();
    const number = `${prefix}-${year}-${String(seq).padStart(6, "0")}`;

    // 3) status workflow + timeline (as in the demo)
    const now = new Date().toISOString();
    const requested = body.status || "Booking Requested";
    const goesToOps = requested === "Booking Requested" || requested === "Pending Operations";
    const finalStatus = goesToOps ? "Pending Operations" : requested;

    const timeline = [{ at: now, by: profile.name, action: `Booking created by ${profile.role}` }];
    if (goesToOps) timeline.push({ at: now, by: profile.name, action: "Sent to Operations" });

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .insert({
        tenant_id: profile.tenant_id,
        booking_number: number,
        customer_id: customerId,
        customer_snapshot: snapshot,
        travel_start_date: body.travel_start_date,
        travel_end_date: body.travel_end_date,
        destination: body.destination,
        num_nights: body.num_nights,
        num_adults: body.num_adults,
        num_children: body.num_children,
        num_rooms: body.num_rooms,
        num_travellers: body.num_travellers,
        lead_source: body.lead_source,
        booked_by: body.booked_by || profile.name,
        booker_mobile: body.booker_mobile,
        booker_email: body.booker_email,
        passengers: body.passengers ?? [],
        adjustments: [],
        sales_executive_id: profile.id,
        sales_executive_name: profile.name,
        special_requirements: body.special_requirements,
        internal_remarks: body.internal_remarks,
        status: finalStatus,
        payment_status: "Unpaid",
        hotels: [],
        flights: [],
        others: [],
        service_charge_total: 0,
        rates_locked: false,
        timeline,
      })
      .select()
      .single();
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

    // 4) notify operations
    if (goesToOps) {
      await supabase.from("notifications").insert({
        tenant_id: profile.tenant_id,
        roles: ["operations"],
        message: `New booking ${number} pending operations`,
        booking_id: booking.id,
        booking_number: number,
        read_by: [],
      });
    }

    const withFin = { ...booking, financials: computeFinancials(booking) };
    return NextResponse.json(redactForRole(withFin, profile.role));
  } catch (e) {
    return errorResponse(e);
  }
}
