import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, assertRole, errorResponse } from "@/lib/auth";
import { paymentSchema } from "@/lib/validators";
import { withTimeline } from "@/lib/booking-service.server";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function GET(req: NextRequest) {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let query = supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(2000);
  const type = req.nextUrl.searchParams.get("type");
  const bookingId = req.nextUrl.searchParams.get("booking_id");
  if (type) query = query.eq("type", type);
  if (bookingId) query = query.eq("booking_id", bookingId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    assertRole(profile.role, ["accounts"]);

    const body = paymentSchema.parse(await req.json());

    const { data: payment, error: pErr } = await supabase
      .from("payments")
      .insert({
        tenant_id: profile.tenant_id,
        type: body.type,
        booking_id: body.booking_id ?? null,
        invoice_id: body.invoice_id ?? null,
        supplier_id: body.supplier_id ?? null,
        amount: body.amount,
        mode: body.mode,
        reference: body.reference,
        remarks: body.remarks,
        date: body.date ?? new Date().toISOString(),
        recorded_by: profile.name,
      })
      .select()
      .single();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    if (body.type === "customer" && body.invoice_id) {
      const { data: inv } = await supabase.from("invoices").select("*").eq("id", body.invoice_id).single();
      if (inv) {
        const received = round2(Number(inv.amount_received || 0) + Number(body.amount));
        const balance = round2(Number(inv.grand_total || 0) - received);
        const status = balance <= 0 ? "Paid" : "Partially Paid";
        await supabase.from("invoices").update({ amount_received: received, balance_due: balance, status }).eq("id", body.invoice_id);

        const bkid = body.booking_id || inv.booking_id;
        if (bkid) {
          const { data: bk } = await supabase.from("bookings").select("timeline, booking_number").eq("id", bkid).single();
          await supabase.from("bookings").update({
            payment_status: balance <= 0 ? "Paid" : "Partial",
            status: balance <= 0 ? "Payment Received" : "Payment Pending",
            timeline: withTimeline(bk?.timeline, profile.name, `Customer payment recorded: Rs. ${body.amount}`),
          }).eq("id", bkid);

          if (balance <= 0) {
            await supabase.from("notifications").insert({
              tenant_id: profile.tenant_id,
              roles: ["accounts", "sales"],
              message: `Payment fully received for ${inv.booking_number}`,
              booking_id: bkid,
              booking_number: inv.booking_number,
              read_by: [],
            });
          }
        }
      }
    } else if (body.type === "supplier" && body.booking_id) {
      const { data: bk } = await supabase.from("bookings").select("timeline").eq("id", body.booking_id).single();
      await supabase.from("bookings")
        .update({ timeline: withTimeline(bk?.timeline, profile.name, `Supplier payment recorded: Rs. ${body.amount}`) })
        .eq("id", body.booking_id);
    }

    return NextResponse.json(payment);
  } catch (e) {
    return errorResponse(e);
  }
}
