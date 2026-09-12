import type { SupabaseClient } from "@supabase/supabase-js";
import { toServiceRows, type ServiceKind } from "@/lib/booking-actions";
import { customerChargeTotal, readCharges } from "@/lib/booking-charges";
import type { Booking } from "@/lib/types";

/** One row = one service, with a reference back to its booking (duty-list style). */
export interface FeedRow {
  bookingId: string;
  bookingNumber: string;
  bookingStatus: string;
  rowId: string;
  kind: ServiceKind;
  date: string | null;
  endDate: string | null;
  time: string | null;
  customer: string;
  passenger: string;
  title: string;
  detail: string;
  address: string;
  city: string;
  supplier: string | null;
  status: string;
  labels: string[];
  amount: number;
  charges: number;
  salesExec: string | null;
}

export interface FeedFilter {
  kind?: ServiceKind;
  /** yyyy-mm-dd (inclusive) */
  from?: string;
  to?: string;
  /** only these statuses (empty = all) */
  statuses?: string[];
  limit?: number;
}

export async function getServiceFeed(
  supabase: SupabaseClient,
  filter: FeedFilter = {},
): Promise<FeedRow[]> {
  const { data } = await supabase
    .from("bookings")
    .select("*")
    .order("travel_start_date", { ascending: true })
    .limit(2000);

  const out: FeedRow[] = [];

  for (const b of (data ?? []) as Booking[]) {
    for (const r of toServiceRows(b)) {
      if (filter.kind && r.kind !== filter.kind) continue;
      if (filter.from && (!r.date || r.date < filter.from)) continue;
      if (filter.to && (!r.date || r.date > filter.to)) continue;
      if (filter.statuses?.length && !filter.statuses.includes(r.status)) continue;

      out.push({
        bookingId: b.id,
        bookingNumber: b.booking_number,
        bookingStatus: b.status,
        rowId: r.rowId,
        kind: r.kind,
        date: r.date,
        endDate: r.endDate,
        time: r.time,
        customer: r.customer,
        passenger: r.passenger,
        title: r.title,
        detail: r.detail,
        address: r.address,
        city: r.city,
        supplier: r.supplierName,
        status: r.status,
        labels: r.labels,
        amount: Number(r.raw.customer_selling_amount ?? 0),
        charges: customerChargeTotal(readCharges(r.raw)),
        salesExec: b.sales_executive_name,
      });
    }
  }

  out.sort((a, z) => (a.date ?? "9999").localeCompare(z.date ?? "9999"));
  return filter.limit ? out.slice(0, filter.limit) : out;
}

/** yyyy-mm-dd, aaj se n din aage/peeche. */
export function dayOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
