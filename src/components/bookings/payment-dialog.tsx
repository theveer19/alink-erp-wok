"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

const MODES = ["Cash", "UPI", "Bank transfer", "Cheque", "Card", "Other"];

interface PaymentRow {
  id: string;
  type: string;
  amount: number;
  mode: string | null;
  reference: string | null;
  date: string | null;
  recorded_by: string | null;
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function PaymentDialog({
  bookingId,
  onClose,
  onSaved,
}: {
  bookingId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("UPI");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payments`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Load fail");
      setRows(j.payments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load fail");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "customer", amount: Number(amount), mode, reference, date, remarks }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save fail");
      setAmount("");
      setReference("");
      setRemarks("");
      await load();
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save fail");
    } finally {
      setSaving(false);
    }
  }

  const received = rows.filter((r) => r.type === "customer").reduce((a, r) => a + Number(r.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Advance payment receipt</h2>
            <p className="text-sm text-slate-500">Record money received from the customer</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Amount *</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {MODES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Reference / UTR</span>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500">Remarks</span>
              <input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Payments on this booking</h3>
              <span className="text-sm text-slate-500">
                Total received: <span className="font-semibold text-slate-800">{inr(received)}</span>
              </span>
            </div>
            {loading && <p className="text-sm text-slate-500">Loading…</p>}
            {!loading && rows.length === 0 && <p className="text-sm text-slate-500">No payments yet.</p>}
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-600">
                    {r.date?.slice(0, 10)} · {r.mode ?? "—"}
                    {r.reference ? ` · ${r.reference}` : ""}
                    <span className="ml-2 text-xs text-slate-400">{r.recorded_by}</span>
                  </span>
                  <span className={r.type === "customer" ? "font-semibold text-emerald-700" : "text-slate-700"}>
                    {inr(r.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Close
          </button>
          <button
            type="button"
            disabled={saving || !amount || Number(amount) <= 0}
            onClick={save}
            className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Record receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}
