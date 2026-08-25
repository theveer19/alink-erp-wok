"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  CHARGE_PRESETS,
  newChargeId,
  readCharges,
  sumCharges,
  type Charge,
} from "@/lib/booking-charges";
import { can, type ServiceRow } from "@/lib/booking-actions";
import type { Role } from "@/lib/types";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function ChargesDialog({
  row,
  role,
  onClose,
  onSave,
}: {
  row: ServiceRow;
  role: Role;
  onClose: () => void;
  onSave: (charges: Charge[]) => void | Promise<void>;
}) {
  const [charges, setCharges] = useState<Charge[]>(readCharges(row.raw));
  const [saving, setSaving] = useState(false);
  const canSupplier = can(role, ["operations", "accounts"]);

  const add = () =>
    setCharges((c) => [
      ...c,
      { id: newChargeId(), label: "", amount: 0, bearer: "customer" as const },
    ]);

  const patch = (id: string, p: Partial<Charge>) =>
    setCharges((c) => c.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const remove = (id: string) => setCharges((c) => c.filter((x) => x.id !== id));

  const customerTotal = sumCharges(charges, "customer");
  const supplierTotal = sumCharges(charges, "supplier");

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Charges</h2>
            <p className="text-sm text-slate-500">{row.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {charges.length === 0 && (
            <p className="rounded border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
              Abhi koi extra charge nahi. Toll, extra bed, early check-in, date change fee — sab yahan add karo.
            </p>
          )}

          {charges.map((c) => (
            <div key={c.id} className="mb-2 grid grid-cols-12 items-center gap-2">
              <input
                list="charge-presets"
                value={c.label}
                onChange={(e) => patch(c.id, { label: e.target.value })}
                placeholder="Charge ka naam"
                className="col-span-5 rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <input
                type="number"
                step="0.01"
                value={c.amount || ""}
                onChange={(e) => patch(c.id, { amount: Number(e.target.value) })}
                placeholder="0.00"
                className="col-span-3 rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
              />
              <select
                value={c.bearer}
                onChange={(e) => patch(c.id, { bearer: e.target.value as Charge["bearer"] })}
                disabled={!canSupplier}
                className="col-span-3 rounded border border-slate-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="customer">Customer se lena</option>
                {canSupplier && <option value="supplier">Supplier cost</option>}
              </select>
              <button
                type="button"
                onClick={() => remove(c.id)}
                aria-label="Remove charge"
                className="col-span-1 rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <datalist id="charge-presets">
            {CHARGE_PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <button
            type="button"
            onClick={add}
            className="mt-2 inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" /> Add charge
          </button>

          <div className="mt-5 space-y-1 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Customer ko bill hoga</span>
              <span className="font-semibold text-slate-800">{inr(customerTotal)}</span>
            </div>
            {canSupplier && (
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier cost me judega</span>
                <span className="font-semibold text-slate-800">{inr(supplierTotal)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || charges.some((c) => !c.label.trim())}
            onClick={async () => {
              setSaving(true);
              await onSave(charges.filter((c) => c.label.trim()));
              setSaving(false);
            }}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save charges"}
          </button>
        </div>
      </div>
    </div>
  );
}
