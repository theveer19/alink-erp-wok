"use client";

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { serviceStatusColor, type ServiceRow } from "@/lib/booking-actions";
import { customerChargeTotal, readCharges } from "@/lib/booking-charges";
import type { Booking } from "@/lib/types";

const inr = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const d = (v: unknown) => (v ? String(v).slice(0, 10) : "—");

/**
 * Closing is a review step, not a single click: every service has to be
 * confirmed or cancelled first, so nothing is billed by accident.
 */
export function CloseBookingDialog({
  booking,
  rows,
  onClose,
  onDone,
}: {
  booking: Booking;
  rows: ServiceRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = rows.filter((r) => r.status !== "Confirmed" && r.status !== "Cancelled");
  const blocked = pending.length > 0;
  const cust = booking.customer_snapshot;

  const post = (body: Record<string, unknown>) =>
    fetch(`/api/bookings/${booking.id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (res) => {
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Request failed");
      return j;
    });

  async function confirmAllPending() {
    setSaving(true);
    setError(null);
    try {
      await post({ action: "confirm_all" });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm services");
      setSaving(false);
    }
  }

  async function closeBooking() {
    setSaving(true);
    setError(null);
    try {
      if (remarks.trim()) {
        await post({ action: "update_booking", fields: { internal_remarks: remarks.trim() } });
      }
      await post({ action: "close_booking" });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not close the booking");
      setSaving(false);
    }
  }

  const info = (label: string, value: React.ReactNode) => (
    <div className="flex gap-2 py-0.5">
      <span className="w-28 shrink-0 text-slate-500">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[900] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <div className="my-6 w-full max-w-3xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Close booking {booking.booking_number}</h2>
            <p className="text-sm text-slate-500">Review everything, then close for billing</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          {/* ---------- customer + booking ---------- */}
          <div className="mb-5 grid grid-cols-1 gap-5 rounded border border-slate-200 p-4 text-sm sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Customer</h3>
              {info("Company", cust?.company || cust?.name || "—")}
              {info("Contact", cust?.name || "—")}
              {info("Mobile", cust?.mobile || "—")}
              {info("Email", cust?.email || "—")}
              {info("GSTIN", cust?.gst_number || "—")}
              {info("Address", cust?.address || "—")}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Booking</h3>
              {info("Status", booking.status)}
              {info("Destination", booking.destination || "—")}
              {info("Travel", `${d(booking.travel_start_date)} → ${d(booking.travel_end_date)}`)}
              {info("Pax", `${booking.num_adults} adult · ${booking.num_children} child`)}
              {info("Nights / rooms", `${booking.num_nights} / ${booking.num_rooms}`)}
              {info("Sales exec", booking.sales_executive_name || "—")}
              {info("Booked by", booking.booked_by || "—")}
            </div>
          </div>

          {(booking.passengers?.length ?? 0) > 0 && (
            <div className="mb-5 rounded border border-slate-200 p-4 text-sm">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Passengers</h3>
              <ul className="space-y-1">
                {(booking.passengers ?? []).map((p, i) => {
                  const o = p as Record<string, unknown>;
                  return (
                    <li key={i} className="text-slate-700">
                      {String(o.name ?? "—")}
                      {o.mobile ? <span className="text-slate-500"> · {String(o.mobile)}</span> : null}
                      {o.email ? <span className="text-slate-500"> · {String(o.email)}</span> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* ---------- services ---------- */}
          <div className="overflow-hidden rounded border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-3 py-2 font-semibold">Service</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 text-right font-semibold">Charges</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      This booking has no services.
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const charges = readCharges(r.raw);
                  return (
                    <React.Fragment key={r.rowId}>
                      <tr className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <span className="font-medium text-slate-800">{r.title}</span>
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                            {r.kind}
                          </span>
                          {r.supplierName && (
                            <span className="block text-xs text-slate-500">Supplier: {r.supplierName}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{r.date ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {inr(customerChargeTotal(charges))}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-800">
                          {inr(r.raw.customer_selling_amount)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${serviceStatusColor(r.status)}`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                      {charges.map((c) => (
                        <tr key={`${r.rowId}-${c.id}`} className="border-t border-slate-50 bg-slate-50/60">
                          <td className="px-3 py-1.5 pl-8 text-slate-600" colSpan={2}>
                            {c.label}
                            {c.remarks ? <span className="text-slate-400"> — {c.remarks}</span> : null}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-600">{inr(c.amount)}</td>
                          <td className="px-3 py-1.5" colSpan={2} />
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex justify-end text-sm">
            <span className="text-slate-500">
              Total sales{" "}
              <span className="ml-2 text-base font-bold text-slate-900">
                {inr(booking.financials?.total_sales)}
              </span>
            </span>
          </div>

          {blocked && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {pending.length} service{pending.length === 1 ? "" : "s"} still pending. Confirm or cancel
                  {pending.length === 1 ? " it" : " them"} before closing.
                </span>
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={confirmAllPending}
                className="mt-2 rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Confirm all pending services
              </button>
            </div>
          )}

          {booking.special_requirements && (
            <div className="mt-4 rounded bg-slate-50 p-3 text-sm">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Special requirements</p>
              <p className="text-slate-700">{booking.special_requirements}</p>
            </div>
          )}

          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Closing remarks (internal)</span>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <p className="mt-3 text-xs text-slate-500">
            After closing, the booking cannot be edited. An admin can reopen it if something needs changing.
          </p>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || blocked || rows.length === 0}
            title={blocked ? "Confirm or cancel the pending services first" : undefined}
            onClick={closeBooking}
            className="rounded bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {saving ? "Closing…" : "Close booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
