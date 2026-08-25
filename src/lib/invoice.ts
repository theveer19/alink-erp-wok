// Invoice items + GST totals — ported 1:1 from the demo invoice_create.

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown) => Number(v || 0);

export interface InvoiceItem {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface InvoiceOpts {
  discount?: number;
  tax_rate?: number;
  gst_basis?: "total" | "service_charge";
  extra_items?: { description?: string; amount?: number }[];
}

export interface InvoiceTotals {
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax_rate: number;
  gst_basis: "total" | "service_charge";
  service_charge_total: number;
  tax_amount: number;
  grand_total: number;
}

type Svc = Record<string, unknown>;
interface BookingLike {
  passengers?: { name?: string }[] | null;
  hotels?: Svc[] | null;
  flights?: Svc[] | null;
  others?: Svc[] | null;
  adjustments?: Svc[] | null;
}
interface CustomerLike {
  hotel_service_charge?: number | null;
  flight_service_charge?: number | null;
}

export function buildInvoice(booking: BookingLike, customer: CustomerLike | null, opts: InvoiceOpts): InvoiceTotals {
  const passengers = booking.passengers ?? [];
  const paxNames = passengers.map((p) => p?.name).filter(Boolean).join(", ");
  const numPax = passengers.length || 1;
  const wp = (desc: string) => (paxNames ? `${desc} - ${paxNames}` : desc);

  const items: InvoiceItem[] = [];

  // helper: push a service as fare line + explicit service-charge line (with pax) + fee lines
  const pushService = (label: string, s: Svc) => {
    const selling = num(s.customer_selling_amount);
    const sc = num(s.customer_service_charge);
    const seat = num(s.seat_fee), ff = num(s.fast_forward_fee), meal = num(s.meal_fee);
    const fare = round2(selling - sc - seat - ff - meal);
    items.push({ description: wp(label), qty: num(s.rooms) || 1, rate: fare, amount: fare });
    if (sc > 0) items.push({ description: `   • Service Charge (${numPax} pax)`, qty: numPax, rate: round2(sc / numPax), amount: sc });
    if (seat > 0) items.push({ description: "   • Seat Fee", qty: 1, rate: seat, amount: seat });
    if (ff > 0) items.push({ description: "   • Fast Forward Fee", qty: 1, rate: ff, amount: ff });
    if (meal > 0) items.push({ description: "   • Meal Fee", qty: 1, rate: meal, amount: meal });
  };

  for (const h of booking.hotels ?? []) {
    const loc = h.city ? ` (${h.city})` : "";
    pushService(`Hotel: ${h.hotel_name || ""}${loc} ${h.room_category || ""} [${num(h.nights)} Nights]`, h);
  }
  for (const f of booking.flights ?? []) {
    pushService(`Flight: ${f.airline || ""} ${f.flight_number || ""} (${f.origin || ""}-${f.destination || ""}) PNR ${f.pnr || "-"}`, f);
  }
  for (const o of booking.others ?? []) {
    pushService(`${o.service_type || "Service"}: ${o.description || ""}`, o);
  }

  for (const a of booking.adjustments ?? []) {
    const amt = num(a.amount);
    items.push({ description: String(a.particulars || "Adjustment"), qty: 1, rate: amt, amount: amt });
  }
  for (const ei of opts.extra_items ?? []) {
    const amt = num(ei.amount);
    if (ei.description || amt) items.push({ description: ei.description || "Additional Charge", qty: 1, rate: amt, amount: amt });
  }

  const subtotal = round2(items.reduce((a, i) => a + num(i.amount), 0));
  const discount = num(opts.discount);
  const tax_rate = opts.tax_rate != null ? num(opts.tax_rate) : 18;
  const allS = [...(booking.hotels ?? []), ...(booking.flights ?? []), ...(booking.others ?? [])];
  const service_charge_total = round2(allS.reduce((a, s) => a + num(s.customer_service_charge), 0));
  const gst_basis = opts.gst_basis || "total";
  const taxable = gst_basis === "service_charge" ? service_charge_total : subtotal - discount;
  const tax_amount = round2((taxable * tax_rate) / 100);
  const grand_total = round2(subtotal - discount + tax_amount);

  return { items, subtotal, discount, tax_rate, gst_basis, service_charge_total, tax_amount, grand_total };
}