"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { serviceStatusColor } from "@/lib/booking-actions";
import type { FeedRow } from "@/lib/service-feed";
import type { Role } from "@/lib/types";

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const STATUSES = ["Pending", "Supplier Requested", "Confirmed", "Cancelled"];

export function ServiceFeedTable({
  rows,
  role,
  showKind = false,
  emptyText = "No services found.",
}: {
  rows: FeedRow[];
  role: Role;
  showKind?: boolean;
  emptyText?: string;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const showSupplier = ["admin", "super_admin", "operations", "accounts"].includes(role);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (!needle) return true;
      return [r.bookingNumber, r.customer, r.passenger, r.title, r.city, r.supplier ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, status]);

  const total = filtered.reduce((a, r) => a + r.amount, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Booking, customer, hotel, city…"
            className="w-72 rounded border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-slate-500">
          {filtered.length} service{filtered.length === 1 ? "" : "s"} · {inr(total)}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600">
              <th className="px-3 py-2.5 font-semibold">Date</th>
              {showKind && <th className="px-3 py-2.5 font-semibold">Type</th>}
              <th className="px-3 py-2.5 font-semibold">Booking</th>
              <th className="px-3 py-2.5 font-semibold">Customer</th>
              <th className="px-3 py-2.5 font-semibold">Service</th>
              <th className="px-3 py-2.5 font-semibold">Details</th>
              <th className="px-3 py-2.5 font-semibold">City</th>
              {showSupplier && <th className="px-3 py-2.5 font-semibold">Supplier</th>}
              <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={showKind ? 10 : 9} className="py-12 text-center text-slate-500">
                  {emptyText}
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const pending = r.status !== "Confirmed" && r.status !== "Cancelled";
              return (
                <tr
                  key={`${r.bookingId}-${r.rowId}`}
                  className={`border-t border-slate-100 ${
                    r.status === "Cancelled"
                      ? "text-slate-400"
                      : pending
                        ? "bg-rose-50/60 hover:bg-rose-50"
                        : "hover:bg-slate-50"
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {r.date ?? "—"}
                    {r.time ? <span className="ml-1 text-xs text-slate-400">{r.time}</span> : null}
                  </td>
                  {showKind && (
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600">
                        {r.kind}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <Link href={`/bookings/${r.bookingId}`} className="text-blue-600 hover:underline">
                      {r.bookingNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{r.customer || "Walk-in"}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-800">{r.title}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.detail}</td>
                  <td className="px-3 py-2.5">{r.city || "—"}</td>
                  {showSupplier && (
                    <td className="px-3 py-2.5">
                      {r.supplier ?? <span className="text-rose-600">Unassigned</span>}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right font-medium">{inr(r.amount)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${serviceStatusColor(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
