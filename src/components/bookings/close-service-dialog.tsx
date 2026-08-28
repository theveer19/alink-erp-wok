"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { newChargeId, readCharges, sumCharges, type Charge } from "@/lib/booking-charges";
import { can, type ServiceRow } from "@/lib/booking-actions";
import type { Role } from "@/lib/types";

/** Items a hotel or flight service usually gets billed for at closing time. */
const ITEMS = [
  "Extra bed",
  "Extra meal",
  "Meal upgrade",
  "Seat selection",
  "Excess baggage",
  "Early check-in",
  "Late check-out",
  "Airport transfer",
  "Toll & parking",
  "Sightseeing / entry ticket",
  "Room upgrade",
  "Date change fee",
  "Cancellation charge",
  "Other",
];

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function CloseServiceDialog({
  row,
  bookingId,
  role,
  onClose,
  onDone,
}: {
  row: ServiceRow;
  bookingId: string;
  role: Role;
  onClose: () => void;
  onDone: () => void;
}) {
  const [charges, setCharges] = useState<Charge[]>(readCharges(row.raw));
  const [remarks, setRemarks] = useState(String(row.raw.remarks ?? ""));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSupplier = can(role, ["operations", "accounts"]);

  const add = () =>
    setCharges((c) => [...c, { id: newChargeId(), label: "", amount: 0, bearer: "customer" }]);
  const patch = (id: string, p: Partial<Charge>) =>
    setCharges((c) => c.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const remove = (id: string) => setCharges((c) => c.filter((x) => x.id !== id));

  const customerTotal = sumCharges(charges, "customer");
  const supplierTotal = sumCharges(charges, "supplier");

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", row.kind === "flight" ? "ticket" : "voucher");
      fd.append("ref", row.rowId);
      const res = await fetch(`/api/bookings/${bookingId}/files`, { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Upload failed");
      setFiles((f) => [...f, j.file?.name ?? file.name]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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

  async function submit(alsoConfirm: boolean) {
    setSaving(true);
    setError(null);
    try {
      const cleaned = charges.filter((c) => c.label.trim());
      await post({ action: "set_charges", rowId: row.rowId, charges: cleaned });
      if (remarks !== String(row.raw.remarks ?? "")) {
        await post({ action: "update_service", rowId: row.rowId, fields: { remarks } });
      }
      if (alsoConfirm && row.status !== "Confirmed") {
        await post({ action: "confirm_service", rowId: row.rowId });
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not close the service");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[900] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <div className="my-6 w-full max-w-3xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Close service</h2>
            <p className="text-sm text-slate-500">
              {row.title} · {row.date ?? "—"} · add anything chargeable before billing
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Billing items</h3>

          <div className="overflow-hidden rounded border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="w-56 px-3 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 font-semibold">Description</th>
                  <th className="w-32 px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="w-40 px-3 py-2 font-semibold">Billed to</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {charges.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                      No billing items yet. Add extra beds, meals, baggage, tolls and anything else chargeable.
                    </td>
                  </tr>
                )}
                {charges.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <input
                        list="close-service-items"
                        value={c.label}
                        onChange={(e) => patch(c.id, { label: e.target.value })}
                        placeholder="Select or type"
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={c.remarks ?? ""}
                        onChange={(e) => patch(c.id, { remarks: e.target.value })}
                        placeholder="Add description (optional)"
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={c.amount || ""}
                        onChange={(e) => patch(c.id, { amount: Number(e.target.value) })}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={c.bearer}
                        onChange={(e) => patch(c.id, { bearer: e.target.value as Charge["bearer"] })}
                        disabled={!canSupplier}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="customer">Customer</option>
                        {canSupplier && <option value="supplier">Supplier cost</option>}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        aria-label="Remove item"
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <datalist id="close-service-items">
            {ITEMS.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> Add another item
            </button>

            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : row.kind === "flight" ? "Attach ticket / bill" : "Attach voucher / bill"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />

            <span className="ml-auto text-sm text-slate-500">
              Customer <span className="font-semibold text-slate-800">{inr(customerTotal)}</span>
              {canSupplier && (
                <>
                  {" · "}Supplier <span className="font-semibold text-slate-800">{inr(supplierTotal)}</span>
                </>
              )}
            </span>
          </div>

          {files.length > 0 && (
            <p className="mt-2 text-xs text-emerald-700">Attached: {files.join(", ")}</p>
          )}

          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Remarks</span>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Anything the accounts team should know before billing"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(false)}
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save only"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(true)}
            className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Closing…" : "Save & close service"}
          </button>
        </div>
      </div>
    </div>
  );
}
