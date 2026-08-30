"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export interface LedgerRow {
  id: string;
  name: string;
  contact: string;
  mobile: string;
  email: string;
  invoiced: number;
  received: number;
  outstanding: number;
  invoices: number;
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function LedgerView({ rows, paymentCount }: { rows: LedgerRow[]; paymentCount: number }) {
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => [r.name, r.contact, r.mobile, r.email].join(" ").toLowerCase().includes(needle));
  }, [rows, q]);

  const totals = visible.reduce(
    (a, r) => ({
      invoiced: a.invoiced + r.invoiced,
      received: a.received + r.received,
      outstanding: a.outstanding + r.outstanding,
    }),
    { invoiced: 0, received: 0, outstanding: 0 },
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-800">Customer ledger</h1>
      <p className="mb-5 text-sm text-slate-500">
        What each customer has been billed, what they have paid, and what is still open.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoiced</p>
          <p className="text-2xl font-bold text-slate-800">{inr(totals.invoiced)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Received</p>
          <p className="text-2xl font-bold text-emerald-700">{inr(totals.received)}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Outstanding</p>
          <p className="text-2xl font-bold text-amber-800">{inr(totals.outstanding)}</p>
        </div>
      </div>

      <div className="relative mb-3 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customer…"
          className="w-full rounded border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-2.5 font-semibold">Customer</th>
              <th className="px-4 py-2.5 font-semibold">Contact</th>
              <th className="px-4 py-2.5 text-right font-semibold">Invoices</th>
              <th className="px-4 py-2.5 text-right font-semibold">Invoiced</th>
              <th className="px-4 py-2.5 text-right font-semibold">Received</th>
              <th className="px-4 py-2.5 text-right font-semibold">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  Nothing billed yet.
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                <td className="px-4 py-2.5 text-slate-500">
                  {[r.contact, r.mobile].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-600">{r.invoices}</td>
                <td className="px-4 py-2.5 text-right text-slate-800">{inr(r.invoiced)}</td>
                <td className="px-4 py-2.5 text-right text-emerald-700">{inr(r.received)}</td>
                <td
                  className={`px-4 py-2.5 text-right font-semibold ${
                    r.outstanding > 0 ? "text-amber-800" : "text-slate-500"
                  }`}
                >
                  {inr(r.outstanding)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Figures come from invoices. {paymentCount} customer payment
        {paymentCount === 1 ? "" : "s"} recorded overall — receipts taken before invoicing show up once the
        invoice is raised.
      </p>
    </div>
  );
}
