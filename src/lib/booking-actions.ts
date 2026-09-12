// Single source of truth for both gear menus on the booking detail screen.
// In a transport ERP a row is a "duty"; here a row is one service (hotel / flight / other).

import type { Booking, Role } from "@/lib/types";

export type ServiceKind = "hotel" | "flight" | "other";

/** One table row = one hotel / flight / other service. */
export interface ServiceRow {
  /** `${kind}:${index}` — this is what we send to the API. */
  rowId: string;
  kind: ServiceKind;
  index: number;
  date: string | null;          // check-in / departure
  endDate: string | null;       // check-out / arrival
  time: string | null;          // 14:00 / 00:15
  customer: string;
  passenger: string;
  title: string;                // Taj Lakefront — Deluxe / 6E-2134 BHO → DEL
  supplierName: string | null;
  detail: string;               // "3 Nights x 2 Rooms" / "Economy - 2 Pax"
  address: string;              // hotel address / sector
  city: string;                 // Bhopal / DEL
  status: string;               // Pending / Confirmed / Cancelled
  labels: string[];
  raw: Record<string, unknown>;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const numOr = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const dateOnly = (v: unknown) => (str(v) ? str(v).slice(0, 10) : null);
const timeOnly = (v: unknown) => {
  const s = str(v);
  if (!s) return null;
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  const t = s.includes("T") ? s.split("T")[1] : "";
  return t ? t.slice(0, 5) : null;
};

export const SERVICE_STATUSES = [
  "Pending",
  "Supplier Requested",
  "Confirmed",
  "Completed",
  "Cancelled",
] as const;

export function serviceStatusColor(status: string): string {
  const map: Record<string, string> = {
    Pending: "bg-amber-100 text-amber-700",
    "Supplier Requested": "bg-blue-100 text-blue-700",
    Confirmed: "bg-emerald-100 text-emerald-700",
    Completed: "bg-slate-200 text-slate-700",
    Cancelled: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-slate-100 text-slate-600";
}

/** Flattens hotels[] / flights[] / others[] into one sorted row list. */
export function toServiceRows(b: Booking): ServiceRow[] {
  const customer = b.customer_snapshot?.name ?? "";
  const firstPax =
    (b.passengers?.[0] as Record<string, unknown> | undefined)?.name ??
    b.booked_by ??
    "";

  const rows: ServiceRow[] = [];

  (b.hotels ?? []).forEach((h, i) => {
    const nights = numOr(h.nights, 1);
    const rooms = numOr(h.rooms, 1);
    rows.push({
      rowId: `hotel:${i}`,
      kind: "hotel",
      index: i,
      date: dateOnly(h.check_in ?? h.check_in_date ?? b.travel_start_date),
      endDate: dateOnly(h.check_out ?? h.check_out_date ?? b.travel_end_date),
      time: timeOnly(h.check_in_time) ?? "14:00",
      customer,
      passenger: str(h.lead_guest) || str(firstPax),
      title:
        [str(h.hotel_name) || str(h.name), str(h.room_type)]
          .filter(Boolean)
          .join(" — ") || "Hotel (name pending)",
      supplierName: str(h.supplier_name) || null,
      detail: `${nights} Night${nights === 1 ? "" : "s"} × ${rooms} Room${rooms === 1 ? "" : "s"}${
        h.meal_plan ? ` · ${str(h.meal_plan)}` : ""
      }`,
      address: str(h.address) || str(h.location),
      city: str(h.city) || str(b.destination),
      status: str(h.status) || "Pending",
      labels: Array.isArray(h.labels) ? (h.labels as string[]) : [],
      raw: h,
    });
  });

  (b.flights ?? []).forEach((f, i) => {
    const from = str(f.from) || str(f.origin) || str(f.sector_from);
    const to = str(f.to) || str(f.destination) || str(f.sector_to);
    rows.push({
      rowId: `flight:${i}`,
      kind: "flight",
      index: i,
      date: dateOnly(f.departure_date ?? f.travel_date ?? b.travel_start_date),
      endDate: dateOnly(f.arrival_date ?? f.departure_date),
      time: timeOnly(f.departure_time ?? f.departure_date),
      customer,
      passenger: str(f.lead_passenger) || str(firstPax),
      title:
        [str(f.airline), str(f.flight_number)].filter(Boolean).join(" ") ||
        "Flight (details pending)",
      supplierName: str(f.supplier_name) || null,
      detail:
        [str(f.class) || "Economy", f.pnr ? `PNR ${str(f.pnr)}` : ""]
          .filter(Boolean)
          .join(" · ") || "Economy",
      address: from && to ? `${from} → ${to}` : from || to,
      city: to || str(b.destination),
      status: str(f.status) || "Pending",
      labels: Array.isArray(f.labels) ? (f.labels as string[]) : [],
      raw: f,
    });
  });

  (b.others ?? []).forEach((o, i) => {
    rows.push({
      rowId: `other:${i}`,
      kind: "other",
      index: i,
      date: dateOnly(o.service_date ?? b.travel_start_date),
      endDate: dateOnly(o.service_end_date ?? o.service_date),
      time: timeOnly(o.service_time),
      customer,
      passenger: str(o.lead_passenger) || str(firstPax),
      title: str(o.service_name) || str(o.description) || "Other service",
      supplierName: str(o.supplier_name) || null,
      detail: str(o.service_type) || "Other",
      address: str(o.pickup_address) || str(o.address),
      city: str(o.city) || str(b.destination),
      status: str(o.status) || "Pending",
      labels: Array.isArray(o.labels) ? (o.labels as string[]) : [],
      raw: o,
    });
  });

  return rows.sort((a, z) => (a.date ?? "").localeCompare(z.date ?? ""));
}

// ---------------------------------------------------------------------------
// Role rules — sales never sees supplier or cost data, accounts owns invoicing
// and operations confirms suppliers. admin/super_admin can do everything.
// ---------------------------------------------------------------------------

export function can(role: Role | undefined, allowed: Role[]): boolean {
  if (role === "admin" || role === "super_admin") return true;
  return !!role && allowed.includes(role);
}

export const BOOKING_LOCKED_STATUSES = ["Completed", "Closed", "Cancelled"];

export function isBookingLocked(b: Pick<Booking, "status" | "invoice_id">): boolean {
  return BOOKING_LOCKED_STATUSES.includes(b.status) || !!b.invoice_id;
}

/** Single action vocabulary shared with the API. */
export type BookingActionType =
  | "send_confirmation"
  | "confirm_all"
  | "unconfirm_all"
  | "delete_booking";

export type ServiceActionType =
  | "confirm_service"
  | "unconfirm_service"
  | "request_supplier"
  | "cancel_service"
  | "set_labels";
