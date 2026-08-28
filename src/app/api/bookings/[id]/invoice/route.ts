import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole, errorResponse, getSessionProfile, HttpError } from "@/lib/auth";
import { getBookingOr404, withTimeline } from "@/lib/booking-service.server";
import { computeFinancials } from "@/lib/bookings";
import { toServiceRows } from "@/lib/booking-actions";
import { readCharges } from "@/lib/booking-charges";
import type { Booking, InvoiceItemT } from "@/lib/types";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown) => Number(v || 0);

const Body = z.object({
  tax_rate: z.coerce.number().min(0).max(100).default(18),
  gst_basis: z.enum(["total", "service_charge"]).default("total"),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().max(500).optional(),
  terms: z.string().max(1000).optional(),
  invoice_date: z.string().max(30).optional(),
});

/** Builds invoice lines from the booking's services and adjustments. */
function buildItems(booking: Booking): InvoiceItemT[] {
  const rows = toServiceRows(booking);
  const items: InvoiceItemT[] = rows
    .filter((r) => r.status !== "Cancelled")
    .map((r) => {
      const amount = round2(num(r.raw.customer_selling_amount));
      const parts: string[] = [r.title];

      if (r.kind === "hotel") {
        const inTime = String(r.raw.check_in_time ?? "14:00");
        const outTime = String(r.raw.check_out_time ?? "11:00");
        parts.push(r.detail);
        parts.push(`Check-in ${r.date ?? "—"} ${inTime} → Check-out ${r.endDate ?? "—"} ${outTime}`);
        if (r.city) parts.push(r.city);
      } else if (r.kind === "flight") {
        parts.push(r.address || r.detail);
        parts.push(`${r.date ?? "—"}${r.time ? ` ${r.time}` : ""}`);
        if (r.raw.pnr) parts.push(`PNR ${String(r.raw.pnr)}`);
      } else {
        parts.push(r.detail);
        if (r.date) parts.push(r.date);
      }

      return { description: parts.filter(Boolean).join(" · "), qty: 1, rate: amount, amount };
    });

  // Extra charges get their own lines under the service they belong to.
  for (const r of rows) {
    if (r.status === "Cancelled") continue;
    for (const c of readCharges(r.raw)) {
      if (c.bearer !== "customer" || !c.amount) continue;
      const amount = round2(c.amount);
      items.push({
        description: `   ${c.label}${c.remarks ? ` — ${c.remarks}` : ""}`,
        qty: 1,
        rate: amount,
        amount,
      });
    }
  }

  // Manual adjustments only. Charge-derived ones (ref "charge:…") are written
  // out by the loop below, so counting them here would bill twice.
  for (const a of booking.adjustments ?? []) {
    const o = a as Record<string, unknown>;
    if (String(o.ref ?? "").startsWith("charge:")) continue;
    const amount = round2(num(o.amount));
    if (!amount) continue;
    items.push({
      description: String(o.label ?? "Adjustment"),
      qty: 1,
      rate: amount,
      amount,
    });
  }

  return items;
}

/** Service charge lives on each service; the booking column is only a manual top-up. */
function serviceChargeTotal(b: Booking): number {
  const rows = toServiceRows(b);
  const fromServices = rows
    .filter((r) => r.status !== "Cancelled")
    .reduce((a, r) => a + num(r.raw.customer_service_charge), 0);
  return round2(num(b.service_charge_total) + fromServices);
}

function totals(items: InvoiceItemT[], b: Booking, opts: z.infer<typeof Body>) {
  const subtotal = round2(items.reduce((a, i) => a + num(i.amount), 0));
  const afterDiscount = round2(subtotal - num(opts.discount));
  const serviceCharge = serviceChargeTotal(b);
  const taxBase = opts.gst_basis === "service_charge" ? serviceCharge : afterDiscount;
  const tax_amount = round2((taxBase * num(opts.tax_rate)) / 100);
  const beforeRound = round2(afterDiscount + tax_amount);
  const grand_total = Math.round(beforeRound);
  const round_off = round2(grand_total - beforeRound);
  return { subtotal, serviceCharge, tax_amount, grand_total, round_off };
}

/** Preview only — the dialog reads numbers from here; nothing is saved. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");

    const booking = (await getBookingOr404(supabase, params.id)) as Booking;
    const items = buildItems(booking);
    const fin = computeFinancials(booking as never);

    return NextResponse.json({
      already: booking.invoice_id
        ? { id: booking.invoice_id, invoice_number: booking.invoice_number ?? null }
        : null,
      customer: booking.customer_snapshot,
      items,
      service_charge_total: serviceChargeTotal(booking),
      total_sales: fin.total_sales,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");
    assertRole(profile.role, ["accounts"]);

    const opts = Body.parse(await req.json());
    const booking = (await getBookingOr404(supabase, params.id)) as Booking;
    const actor = profile.name || profile.email || "system";

    if (booking.invoice_id) {
      throw new HttpError(409, `An invoice already exists for this booking (${booking.invoice_number ?? ""})`);
    }

    const items = buildItems(booking);
    if (items.length === 0) throw new HttpError(400, "No billable services found for this invoice");

    const t = totals(items, booking, opts);

    // Invoice number: INV-<year>-<6 digit serial>, per tenant.
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", profile.tenant_id);
    const invoice_number = `INV-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        tenant_id: profile.tenant_id,
        invoice_number,
        booking_id: booking.id,
        booking_number: booking.booking_number,
        customer: {
          ...(booking.customer_snapshot ?? {}),
          // Bill in the company's name when there is one.
          name: booking.customer_snapshot?.company || booking.customer_snapshot?.name || "",
          contact_person: booking.customer_snapshot?.name ?? null,
        },
        items,
        subtotal: t.subtotal,
        discount: opts.discount,
        tax_rate: opts.tax_rate,
        gst_basis: opts.gst_basis,
        service_charge_total: t.serviceCharge,
        tax_amount: t.tax_amount,
        grand_total: t.grand_total,
        amount_received: 0,
        balance_due: t.grand_total,
        status: "Unpaid",
        notes: opts.notes ?? null,
        terms: opts.terms ?? null,
        invoice_date: opts.invoice_date || new Date().toISOString().slice(0, 10),
        created_by: actor,
      })
      .select("*")
      .single();
    if (error) throw new HttpError(500, error.message);

    const { error: bErr } = await supabase
      .from("bookings")
      .update({
        invoice_id: invoice.id,
        invoice_number,
        status: "Invoice Generated",
        payment_status: "Unpaid",
        timeline: withTimeline(booking.timeline, actor, `Invoice ${invoice_number} generated`),
      })
      .eq("id", booking.id);
    if (bErr) {
      await supabase.from("invoices").delete().eq("id", invoice.id); // rollback
      throw new HttpError(500, bErr.message);
    }

    return NextResponse.json({ invoice, redirect: `/invoices/${invoice.id}` });
  } catch (e) {
    return errorResponse(e);
  }
}


/** Delete the invoice and make the booking editable again. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");
    assertRole(profile.role, ["accounts"]);

    const booking = (await getBookingOr404(supabase, params.id)) as Booking;
    if (!booking.invoice_id) throw new HttpError(404, "This booking has no invoice");
    const actor = profile.name || profile.email || "system";

    const { count } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", booking.invoice_id);
    if ((count ?? 0) > 0) {
      throw new HttpError(409, "Payments are recorded against this invoice — remove them first");
    }

    const { error: dErr } = await supabase.from("invoices").delete().eq("id", booking.invoice_id);
    if (dErr) throw new HttpError(500, dErr.message);

    const { error } = await supabase
      .from("bookings")
      .update({
        invoice_id: null,
        invoice_number: null,
        status: "Pending Operations",
        timeline: withTimeline(booking.timeline, actor, `Invoice ${booking.invoice_number ?? ""} deleted`),
      })
      .eq("id", params.id);
    if (error) throw new HttpError(500, error.message);

    return NextResponse.json({ ok: true, redirect: `/bookings/${params.id}` });
  } catch (e) {
    return errorResponse(e);
  }
}
