"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { newChargeId, readCharges, type Charge } from "@/lib/booking-charges";
import type { ServiceRow } from "@/lib/booking-actions";

const inr = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * Cancelling is rarely free: the supplier keeps a slice, we keep our fee, and
 * whatever is left goes back to the customer. All three get recorded here.
 */
export function CancelServiceDialog({
  row,
  bookingId,
  onClose,
  onDone,
}: {
  row: ServiceRow;
  bookingId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const sold = Number(row.raw.customer_selling_amount ?? 0);
  const cost = Number(row.raw.total_supplier_cost ?? 0);

  const [supplierPenalty, setSupplierPenalty] = useState("");
  const [ourFee, setOurFee] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refund = useMemo(
    () => Math.max(0, sold - Number(supplierPenalty || 0) - Number(ourFee || 0)),
    [sold, supplierPenalty, ourFee],
  );

  const post = (body: Record<string, unknown>) =>
    fetch(`/api/bookings/${bookingId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (res) => {
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Request failed");
      return j;
    });

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const keep = Number(supplierPenalty || 0) + Number(ourFee || 0);
      const charges: Charge[] = readCharges(row.raw).filter((c) => !c.label.startsWith("Cancellation"));

      if (keep > 0) {
        charges.push({
          id: newChargeId(),
          label: "Cancellation charge",
          amount: keep,
          bearer: "customer",
          remarks:
            [
              Number(supplierPenalty) ? `supplier penalty ${inr(supplierPenalty)}` : "",
              Number(ourFee) ? `our fee ${inr(ourFee)}` : "",
              reason,
            ]
              .filter(Boolean)
              .join(" · ") || undefined,
        });
      }

      await post({ action: "set_charges", rowId: row.rowId, charges });
      await post({
        action: "update_service",
        rowId: row.rowId,
        fields: {
          cancellation_reason: reason || null,
          cancellation_supplier_penalty: Number(supplierPenalty || 0),
          cancellation_fee: Number(ourFee || 0),
          cancellation_refund: refund,
        },
      });
      await post({ action: "cancel_service", rowId: row.rowId });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel the service");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[900] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <div className="my-6 w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Cancel service</h2>
            <p className="text-sm text-slate-500">{row.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded bg-slate-50 p-3 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">Sold for</span>
              <span className="font-medium text-slate-800">{inr(sold)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">Supplier cost</span>
              <span className="text-slate-800">{inr(cost)}</span>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Supplier penalty (what the airline or hotel keeps)
            </span>
            <input
              type="number"
              step="0.01"
              value={supplierPenalty}
              onChange={(e) => setSupplierPenalty(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Our cancellation fee</span>
            <input
              type="number"
              step="0.01"
              value={ourFee}
              onChange={(e) => setOurFee(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Reason</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Guest cancelled, flight rescheduled, no-show…"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-emerald-800">Refund due to customer</span>
              <span className="text-base font-bold text-emerald-800">{inr(refund)}</span>
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              Record the actual refund under Payments once the money goes out.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Keep service
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="rounded bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Cancelling…" : "Cancel service"}
          </button>
        </div>
      </div>
    </div>
  );
}
