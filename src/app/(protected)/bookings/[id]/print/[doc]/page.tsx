import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { computeFinancials, redactForRole } from "@/lib/bookings";
import { toServiceRows, type ServiceRow } from "@/lib/booking-actions";
import { customerChargeTotal, readCharges } from "@/lib/booking-charges";
import { PrintShell } from "@/components/print/print-shell";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

const DOCS = {
  confirmation: "Booking Confirmation",
  voucher: "Hotel Voucher",
  eticket: "Flight E-Ticket",
  briefing: "Operations Briefing Sheet",
} as const;

type Doc = keyof typeof DOCS;

const inr = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dt = (v: unknown) => (v ? String(v).slice(0, 10) : "—");

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

function ServiceBlock({ row, showCost }: { row: ServiceRow; showCost: boolean }) {
  const charges = readCharges(row.raw);
  return (
    <div className="mb-4 break-inside-avoid rounded border border-slate-200 p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{row.kind}</p>
          <p className="text-base font-semibold text-slate-800">{row.title}</p>
        </div>
        <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600">{row.status}</span>
      </div>

      <Row label="Date" value={`${row.date ?? "—"}${row.endDate && row.endDate !== row.date ? ` → ${row.endDate}` : ""}`} />
      <Row label={row.kind === "flight" ? "Sector" : "Address"} value={row.address || "—"} />
      <Row label="City" value={row.city || "—"} />
      <Row label="Details" value={row.detail} />
      <Row label="Passenger" value={row.passenger || "—"} />
      {row.kind === "hotel" && <Row label="Confirmation no." value={String(row.raw.confirmation_number ?? "—")} />}
      {row.kind === "flight" && <Row label="PNR" value={String(row.raw.pnr ?? "—")} />}
      {showCost && <Row label="Supplier" value={row.supplierName ?? "—"} />}
      {showCost && <Row label="Supplier cost" value={inr(row.raw.total_supplier_cost)} />}
      <Row label="Amount" value={inr(row.raw.customer_selling_amount)} />

      {charges.length > 0 && (
        <div className="mt-2 rounded bg-slate-50 p-2 text-xs">
          <p className="mb-1 font-semibold text-slate-600">Extra charges</p>
          {charges
            .filter((c) => c.bearer === "customer")
            .map((c) => (
              <div key={c.id} className="flex justify-between py-0.5 text-slate-600">
                <span>{c.label}</span>
                <span>{inr(c.amount)}</span>
              </div>
            ))}
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-700">
            <span>Total</span>
            <span>{inr(customerChargeTotal(charges))}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default async function PrintDocPage({
  params,
  searchParams,
}: {
  params: { id: string; doc: string };
  searchParams: { row?: string };
}) {
  const doc = params.doc as Doc;
  if (!(doc in DOCS)) notFound();

  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  const { data } = await supabase.from("bookings").select("*").eq("id", params.id).single();
  if (!data) notFound();

  const booking = redactForRole({ ...data, financials: computeFinancials(data) }, profile.role) as Booking;
  const allRows = toServiceRows(booking);
  const showCost = doc === "briefing" && ["admin", "super_admin", "operations", "accounts"].includes(profile.role);

  let rows = allRows;
  if (searchParams.row) rows = allRows.filter((r) => r.rowId === searchParams.row);
  else if (doc === "voucher") rows = allRows.filter((r) => r.kind === "hotel");
  else if (doc === "eticket") rows = allRows.filter((r) => r.kind === "flight");

  const fin = booking.financials;
  const cust = booking.customer_snapshot;

  return (
    <PrintShell title={DOCS[doc]}>
      <header className="mb-5 flex items-start justify-between border-b-2 border-slate-800 pb-3">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wide text-slate-800">{DOCS[doc]}</h1>
          <p className="text-sm text-slate-500">Booking #{booking.booking_number}</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p>Date: {new Date().toISOString().slice(0, 10)}</p>
          <p>Status: {booking.status}</p>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Customer</h2>
          <p className="font-semibold text-slate-800">{cust?.name ?? "—"}</p>
          {cust?.company && <p className="text-sm text-slate-600">{cust.company}</p>}
          {cust?.mobile && <p className="text-sm text-slate-600">{cust.mobile}</p>}
          {cust?.email && <p className="text-sm text-slate-600">{cust.email}</p>}
          {cust?.gst_number && <p className="text-sm text-slate-600">GST: {cust.gst_number}</p>}
        </div>
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Trip</h2>
          <Row label="Destination" value={booking.destination ?? "—"} />
          <Row label="Travel" value={`${dt(booking.travel_start_date)} → ${dt(booking.travel_end_date)}`} />
          <Row label="Pax" value={`${booking.num_adults} adult, ${booking.num_children} child`} />
          <Row label="Nights / Rooms" value={`${booking.num_nights} / ${booking.num_rooms}`} />
          {doc === "briefing" && <Row label="Sales exec" value={booking.sales_executive_name ?? "—"} />}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
          {doc === "voucher" ? "Hotel details" : doc === "eticket" ? "Flight details" : "Services"}
        </h2>
        {rows.length === 0 ? (
          <p className="rounded border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500">
            No services found for this document.
          </p>
        ) : (
          rows.map((r) => <ServiceBlock key={r.rowId} row={r} showCost={showCost} />)
        )}
      </section>

      {doc === "confirmation" && fin && (
        <section className="mt-4 ml-auto w-64">
          <Row label="Total" value={inr(fin.total_sales)} />
        </section>
      )}

      {doc === "briefing" && fin && showCost && (
        <section className="mt-4 ml-auto w-72">
          <Row label="Total sales" value={inr(fin.total_sales)} />
          <Row label="Supplier cost" value={inr(fin.total_supplier_cost)} />
          <Row label="Gross profit" value={inr(fin.gross_profit)} />
          <Row label="Margin" value={`${Number(fin.margin ?? 0).toFixed(1)}%`} />
        </section>
      )}

      {booking.special_requirements && (
        <section className="mt-5 rounded bg-slate-50 p-3">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Special requirements</h3>
          <p className="text-sm text-slate-700">{booking.special_requirements}</p>
        </section>
      )}

      {doc === "briefing" && booking.internal_remarks && (
        <section className="mt-3 rounded bg-amber-50 p-3">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-600">Internal remarks</h3>
          <p className="text-sm text-slate-700">{booking.internal_remarks}</p>
        </section>
      )}

      <footer className="mt-8 border-t border-slate-200 pt-3 text-center text-xs text-slate-400">
        {doc === "confirmation"
          ? "This is a computer generated confirmation."
          : doc === "briefing"
            ? "Internal use only — do not share with the customer."
            : "Please carry this document at check-in."}
      </footer>
    </PrintShell>
  );
}
