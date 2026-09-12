// Shared booking logic â€” ported 1:1 from the demo's compute_financials
// and redact_for_role so numbers match exactly.

export const BOOKING_STATUSES = [
  "Enquiry",
  "Quotation",
  "Booking Requested",
  "Pending Operations",
  "Supplier Pending",
  "Supplier Confirmed",
  "Customer Confirmed",
  "Partially Confirmed",
  "Completed",
  "Closed",
  "Invoice Generated",
  "Payment Pending",
  "Payment Received",
  "Cancelled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Tailwind classes per status (badge look from the approved demo).
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    Enquiry: "bg-slate-100 text-slate-600",
    Quotation: "bg-slate-100 text-slate-600",
    "Booking Requested": "bg-blue-100 text-blue-700",
    "Pending Operations": "bg-amber-100 text-amber-700",
    "Supplier Pending": "bg-amber-100 text-amber-700",
    "Supplier Confirmed": "bg-cyan-100 text-cyan-700",
    "Customer Confirmed": "bg-emerald-100 text-emerald-700",
    "Partially Confirmed": "bg-yellow-100 text-yellow-700",
    Completed: "bg-emerald-100 text-emerald-700",
    Closed: "bg-slate-200 text-slate-700",
    "Invoice Generated": "bg-violet-100 text-violet-700",
    "Payment Pending": "bg-orange-100 text-orange-700",
    "Payment Received": "bg-emerald-100 text-emerald-700",
    Cancelled: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-slate-100 text-slate-600";
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface BookingFinancials {
  hotel_sales: number;
  flight_sales: number;
  other_sales: number;
  total_sales: number;
  total_supplier_cost: number;
  gross_profit: number;
  margin: number;
}

type ServiceItem = Record<string, unknown>;
export interface BookingLike {
  hotels?: ServiceItem[] | null;
  flights?: ServiceItem[] | null;
  others?: ServiceItem[] | null;
  adjustments?: ServiceItem[] | null;
  service_charge_total?: number | null;
}

export function computeFinancials(b: BookingLike): BookingFinancials {
  const hotels = b.hotels ?? [];
  const flights = b.flights ?? [];
  const others = b.others ?? [];
  const num = (v: unknown) => Number(v || 0);
  const sum = (items: ServiceItem[], f: string) =>
    round2(items.reduce((a, i) => a + num(i[f]), 0));

  const hotel_sales = sum(hotels, "customer_selling_amount");
  const flight_sales = sum(flights, "customer_selling_amount");
  const other_sales = sum(others, "customer_selling_amount");
  const adj_total = round2((b.adjustments ?? []).reduce((a, x) => a + num(x.amount), 0));
  const sc_total = num(b.service_charge_total);
  const total_sales = round2(hotel_sales + flight_sales + other_sales + adj_total + sc_total);
  const total_supplier_cost = sum([...hotels, ...flights, ...others], "total_supplier_cost");
  const gross_profit = round2(total_sales - total_supplier_cost);
  const margin = round2(total_sales ? (gross_profit / total_sales) * 100 : 0);

  return { hotel_sales, flight_sales, other_sales, total_sales, total_supplier_cost, gross_profit, margin };
}

// Sales staff must never see supplier cost / profit â€” strip those fields.
export function redactForRole<T extends Record<string, unknown>>(booking: T, role: string): T {
  if (role !== "sales") return booking;
  const b: Record<string, unknown> = { ...booking };
  for (const key of ["hotels", "flights", "others"] as const) {
    const arr = (b[key] as ServiceItem[] | undefined) ?? [];
    b[key] = arr.map((s) => {
      const copy = { ...s };
      for (const f of SUPPLIER_FIELDS) delete copy[f];
      return copy;
    });
  }
  const fin = b.financials as Partial<BookingFinancials> | undefined;
  if (fin) {
    b.financials = { ...fin, total_supplier_cost: undefined, gross_profit: undefined, margin: undefined };
  }
  return b as T;
}

// ---- Per-service calculation (ported 1:1 from demo recompute_service) ----

export const RATE_BASES = [
  { value: "flat", label: "Flat" },
  { value: "per_pax", label: "Per Pax" },
  { value: "per_night", label: "Per Room / Night" },
  { value: "per_pax_night", label: "Per Pax Ã— Night" },
] as const;

export function basisFactor(basis: string | undefined, numPax: number, nights: number, rooms = 1): number {
  const p = Math.trunc(numPax || 1);
  const n = Math.trunc(nights || 1);
  if (basis === "per_pax") return p;
  if (basis === "per_night") return n * Math.max(Math.trunc(rooms || 1), 1);
  if (basis === "per_pax_night") return p * n;
  return 1;
}

export interface ServiceComputed {
  total_supplier_cost: number;
  extra_fees: number;
  customer_selling_amount: number;
  markup: number;
  profit: number;
  margin: number;
}

export function recomputeService(s: Record<string, unknown>, numPax: number): Record<string, unknown> {
  const n = (v: unknown) => Number(v || 0);
  const supplier_rate = n(s.supplier_rate);
  const supplier_sc = n(s.supplier_service_charge);
  const taxes = n(s.taxes);
  const other = n(s.other_charges);
  const total_supplier_cost = round2(supplier_rate + supplier_sc + taxes + other);

  const extra = n(s.seat_fee) + n(s.fast_forward_fee) + n(s.meal_fee);
  const extra_fees = round2(extra);

  const nights = Math.trunc(n(s.nights) || 1);
  const rooms = Math.trunc(n(s.rooms) || 1);
  const pax = Math.trunc(numPax || 1);
  const unit = n(s.sales_rate);
  const customer_rate = n(s.customer_rate);
  const customer_sc = n(s.customer_service_charge);

  let base: number;
  if (s.rate_basis && s.rate_basis !== "flat" && unit) {
    base = unit * basisFactor(String(s.rate_basis), pax, nights, rooms) + customer_sc;
  } else if (customer_rate || customer_sc) {
    base = customer_rate + customer_sc;
  } else {
    base = unit;
  }

  const selling = base + extra;
  const customer_selling_amount = round2(selling);
  const profit = round2(selling - total_supplier_cost);
  const margin = round2(selling ? (profit / selling) * 100 : 0);

  return {
    ...s,
    total_supplier_cost,
    extra_fees,
    customer_selling_amount,
    markup: profit,
    profit,
    margin,
  };
}

export const SERVICE_KEY: Record<string, "hotels" | "flights" | "others"> = {
  hotel: "hotels",
  flight: "flights",
  other: "others",
};

// Fields only operations/admin may see or set (sales is blind to cost/profit).
export const SUPPLIER_FIELDS = [
  "supplier_id", "supplier_name", "supplier_booking_id", "supplier_contact",
  "supplier_reference", "supplier_rate", "supplier_service_charge", "currency",
  "taxes", "other_charges", "total_supplier_cost",
] as const;

export function numPaxOf(b: { passengers?: unknown[]; num_travellers?: number | null }): number {
  const p = Array.isArray(b.passengers) ? b.passengers.length : 0;
  return p || Number(b.num_travellers || 1) || 1;
}
