"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Hotel, Plane, Plus, Sparkles, Trash2 } from "lucide-react";
import { numPaxOf } from "@/lib/bookings";
import { can, toServiceRows, type ServiceRow } from "@/lib/booking-actions";
import { ServiceEditDialog } from "@/components/bookings/service-edit-dialog";
import type { Booking, Role } from "@/lib/types";

export function BookingEditView({ booking, role }: { booking: Booking; role: Role }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<ServiceRow | null>(null);

  const [form, setForm] = useState({
    customer_name: booking.customer_snapshot?.name ?? "",
    customer_mobile: booking.customer_snapshot?.mobile ?? "",
    customer_email: booking.customer_snapshot?.email ?? "",
    destination: booking.destination ?? "",
    travel_start_date: (booking.travel_start_date ?? "").slice(0, 10),
    travel_end_date: (booking.travel_end_date ?? "").slice(0, 10),
    num_nights: booking.num_nights ?? 1,
    num_adults: booking.num_adults ?? 1,
    num_children: booking.num_children ?? 0,
    num_rooms: booking.num_rooms ?? 1,
    lead_source: booking.lead_source ?? "",
    booked_by: booking.booked_by ?? "",
    booker_mobile: booking.booker_mobile ?? "",
    special_requirements: booking.special_requirements ?? "",
    internal_remarks: booking.internal_remarks ?? "",
  });

  const rows = useMemo(() => toServiceRows(booking), [booking]);
  const pax = useMemo(() => numPaxOf(booking as never), [booking]);

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save fail");
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kuch galat ho gaya");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveBooking() {
    const num_travellers = Number(form.num_adults || 0) + Number(form.num_children || 0);
    const ok = await call({
      action: "update_booking",
      fields: {
        customer_snapshot: {
          ...(booking.customer_snapshot ?? {}),
          name: form.customer_name,
          mobile: form.customer_mobile,
          email: form.customer_email,
        },
        destination: form.destination || null,
        travel_start_date: form.travel_start_date || null,
        travel_end_date: form.travel_end_date || null,
        num_nights: Number(form.num_nights) || 1,
        num_adults: Number(form.num_adults) || 1,
        num_children: Number(form.num_children) || 0,
        num_rooms: Number(form.num_rooms) || 1,
        num_travellers: num_travellers || 1,
        lead_source: form.lead_source || null,
        booked_by: form.booked_by || null,
        booker_mobile: form.booker_mobile || null,
        special_requirements: form.special_requirements || null,
        internal_remarks: form.internal_remarks || null,
      },
    });
    if (ok) router.push(`/bookings/${booking.id}`);
  }

  const field = (
    label: string,
    key: keyof typeof form,
    type: "text" | "number" | "date" | "textarea" = "text",
    span = false,
  ) => (
    <label className={span ? "sm:col-span-2" : ""}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {type === "textarea" ? (
        <textarea
          rows={2}
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      ) : (
        <input
          type={type}
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, type === "number" ? Number(e.target.value) : e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      )}
    </label>
  );

  const addBtn = (kind: "hotel" | "flight" | "other", label: string, Icon: typeof Hotel) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => call({ action: "add_service", kind })}
      className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      <Icon className="h-4 w-4" /> <Plus className="h-3 w-3" /> {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/bookings/${booking.id}`}
            aria-label="Back"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronLeft className="h-7 w-7" />
          </Link>
          <h1 className="text-2xl font-semibold text-slate-800">Edit Booking #{booking.booking_number}</h1>
          <div className="ml-auto flex gap-2">
            <Link
              href={`/bookings/${booking.id}`}
              className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={saveBooking}
              className="rounded bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <section className="mt-5 rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Customer & trip</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("Customer name", "customer_name")}
            {field("Customer mobile", "customer_mobile")}
            {field("Customer email", "customer_email")}
            {field("Destination", "destination")}
            {field("Travel from", "travel_start_date", "date")}
            {field("Travel to", "travel_end_date", "date")}
            {field("Nights", "num_nights", "number")}
            {field("Rooms", "num_rooms", "number")}
            {field("Adults", "num_adults", "number")}
            {field("Children", "num_children", "number")}
            {field("Lead source", "lead_source")}
            {field("Booked by", "booked_by")}
            {field("Booker mobile", "booker_mobile")}
            {field("Special requirements", "special_requirements", "textarea", true)}
            {can(role, ["operations"]) && field("Internal remarks", "internal_remarks", "textarea", true)}
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Services</h2>
            <div className="ml-auto flex flex-wrap gap-2">
              {addBtn("hotel", "Hotel", Hotel)}
              {addBtn("flight", "Flight", Plane)}
              {addBtn("other", "Other", Sparkles)}
            </div>
          </div>

          {rows.length === 0 && (
            <p className="rounded border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
              Koi service nahi. Upar se Hotel ya Flight add karo.
            </p>
          )}

          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.rowId} className="flex flex-wrap items-center gap-3 py-3">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-500">
                  {row.kind}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{row.title}</p>
                  <p className="text-xs text-slate-500">
                    {row.date ?? "date pending"} · {row.detail}
                    {can(role, ["operations", "accounts"]) && row.supplierName ? ` · ${row.supplierName}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditRow(row)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`"${row.title}" hata dein?`))
                      call({ action: "remove_service", rowId: row.rowId });
                  }}
                  aria-label="Remove service"
                  className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {editRow && (
        <ServiceEditDialog
          row={editRow}
          role={role}
          numPax={pax}
          focus={null}
          onClose={() => setEditRow(null)}
          onSave={async (fields) => {
            await call({ action: "update_service", rowId: editRow.rowId, fields });
            setEditRow(null);
          }}
        />
      )}
    </div>
  );
}
