"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

interface Item {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function InvoiceDialog({
  bookingId,
  onClose,
  onCreated,
}: {
  bookingId: string;
  onClose: () => void;
  onCreated: (redirect: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [already, setAlready] = useState<{ id: string; invoice_number: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taxRate, setTaxRate] = useState("18");
  const [gstBasis, setGstBasis] = useState<"total" | "service_charge">("total");
  const [discount, setDiscount] = useState("0");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/invoice`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Load fail");
      setItems(j.items ?? []);
      setServiceCharge(Number(j.service_charge_total || 0));
      setAlready(j.already ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load fail");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const t = useMemo(() => {
    const subtotal = round2(items.reduce((a, i) => a + Number(i.amount || 0), 0));
    const afterDiscount = round2(subtotal - Number(discount || 0));
    const base = gstBasis === "service_charge" ? serviceCharge : afterDiscount;
    const tax = round2((base * Number(taxRate || 0)) / 100);
    return { subtotal, afterDiscount, tax, grand: round2(afterDiscount + tax) };
  }, [items, discount, gstBasis, taxRate, serviceCharge]);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tax_rate: Number(taxRate),
          gst_basis: gstBasis,
          discount: Number(discount),
          invoice_date: invoiceDate,
          notes,
          terms,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not create the invoice");
      onCreated(j.redirect ?? "/invoices");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invoice fail");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Generate invoice</h2>
            <p className="text-sm text-slate-500">Line items are built from the booking's services</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}

          {already && (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              An invoice already exists for this booking
              {already.invoice_number ? ` (${already.invoice_number})` : ""}.{" "}
              <button
                type="button"
                onClick={() => onCreated(`/invoices/${already.id}`)}
                className="font-semibold underline"
              >
                Open invoice
              </button>
            </div>
          )}

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-2 font-semibold">Description</th>
                <th className="w-16 py-2 text-right font-semibold">Qty</th>
                <th className="w-28 py-2 text-right font-semibold">Rate</th>
                <th className="w-28 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-slate-700">{it.description}</td>
                  <td className="py-2 text-right text-slate-600">{it.qty}</td>
                  <td className="py-2 text-right text-slate-600">{inr(it.rate)}</td>
                  <td className="py-2 text-right font-medium text-slate-800">{inr(it.amount)}</td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No billable services found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Apply GST on</span>
                <select
                  value={gstBasis}
                  onChange={(e) => setGstBasis(e.target.value as "total" | "service_charge")}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="service_charge">Service charge only ({inr(serviceCharge)})</option>
                  <option value="total">Full invoice total</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1 block text-xs font-medium text-slate-500">Tax rate %</span>
                  <input
                    type="number"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-slate-500">Discount</span>
                  <input
                    type="number"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Invoice date</span>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-800">{inr(t.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Discount</span>
                <span className="text-slate-800">− {inr(Number(discount || 0))}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">CGST @ {(Number(taxRate || 0) / 2).toFixed(1)}%</span>
                <span className="text-slate-800">{inr(t.tax / 2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">SGST @ {(Number(taxRate || 0) / 2).toFixed(1)}%</span>
                <span className="text-slate-800">{inr(t.tax / 2)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base">
                <span className="font-semibold text-slate-700">Grand total</span>
                <span className="font-bold text-slate-900">{inr(t.grand)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Notes</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Terms</span>
              <textarea
                rows={2}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading || items.length === 0 || !!already}
            onClick={create}
            className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
