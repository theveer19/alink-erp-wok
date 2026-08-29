"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { RATE_BASES, recomputeService } from "@/lib/bookings";
import { newChargeId, readCharges, sumCharges, type Charge } from "@/lib/booking-charges";
import { can, type ServiceRow } from "@/lib/booking-actions";
import type { Role } from "@/lib/types";

interface Supplier {
  id: string;
  name: string;
  supplier_type?: string | null;
  contact_person?: string | null;
  mobile?: string | null;
  payment_terms?: string | null;
  default_rate?: number | null;
  default_service_charge?: number | null;
}

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

const inr = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function CloseServiceDialog({
  row,
  bookingId,
  role,
  numPax,
  onClose,
  onDone,
}: {
  row: ServiceRow;
  bookingId: string;
  role: Role;
  numPax: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const canSupplier = can(role, ["operations", "accounts"]);

  // ---- customer side ----
  const [basis, setBasis] = useState(String(row.raw.rate_basis ?? "flat"));
  const [custRate, setCustRate] = useState(String(row.raw.sales_rate ?? row.raw.customer_rate ?? ""));
  const [custServiceCharge, setCustServiceCharge] = useState(String(row.raw.customer_service_charge ?? ""));
  const [seatFee, setSeatFee] = useState(String(row.raw.seat_fee ?? ""));
  const [mealFee, setMealFee] = useState(String(row.raw.meal_fee ?? ""));
  const [baggageFee, setBaggageFee] = useState(String(row.raw.fast_forward_fee ?? ""));
  const [feeNote, setFeeNote] = useState(String(row.raw.fee_note ?? ""));
  const [pnr, setPnr] = useState(String(row.raw.pnr ?? ""));

  // ---- supplier side ----
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState(String(row.raw.supplier_id ?? ""));
  const [rate, setRate] = useState(String(row.raw.supplier_rate ?? ""));
  const [serviceCharge, setServiceCharge] = useState(String(row.raw.supplier_service_charge ?? ""));
  const [supSeatFee, setSupSeatFee] = useState(String(row.raw.supplier_seat_fee ?? ""));
  const [supMealFee, setSupMealFee] = useState(String(row.raw.supplier_meal_fee ?? ""));
  const [supBaggageFee, setSupBaggageFee] = useState(String(row.raw.supplier_fast_forward_fee ?? ""));

  // Mirror keeps the supplier figures equal to the customer ones until the
  // supplier's real rate is known — buying at cost, zero margin, no surprises.
  const [mirror, setMirror] = useState(!Number(row.raw.supplier_rate));

  const [charges, setCharges] = useState<Charge[]>(readCharges(row.raw));
  const [remarks, setRemarks] = useState(String(row.raw.remarks ?? ""));
  const [files, setFiles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!canSupplier) return;
    let alive = true;
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((j) => {
        const list: Supplier[] = Array.isArray(j) ? j : (j.data ?? j.suppliers ?? []);
        if (alive) setSuppliers(list);
      })
      .catch(() => void 0);
    return () => {
      alive = false;
    };
  }, [canSupplier]);

  const setCustomerRate = (v: string) => {
    setCustRate(v);
    if (mirror) setRate(v);
  };
  // Service charge is our own margin — it never belongs on the supplier side.
  const setCustomerServiceCharge = (v: string) => setCustServiceCharge(v);

  const setSeat = (v: string) => {
    setSeatFee(v);
    if (mirror) setSupSeatFee(v);
  };
  const setMeal = (v: string) => {
    setMealFee(v);
    if (mirror) setSupMealFee(v);
  };
  const setBaggage = (v: string) => {
    setBaggageFee(v);
    if (mirror) setSupBaggageFee(v);
  };

  const toggleMirror = (on: boolean) => {
    setMirror(on);
    if (on) {
      setRate(custRate);
      setSupSeatFee(seatFee);
      setSupMealFee(mealFee);
      setSupBaggageFee(baggageFee);
    }
  };

  function chooseSupplier(id: string) {
    setSupplierId(id);
    const s = suppliers.find((x) => x.id === id);
    if (!s) return;
    if (!Number(rate) && s.default_rate) setRate(String(s.default_rate));
    if (!Number(serviceCharge) && s.default_service_charge) setServiceCharge(String(s.default_service_charge));
  }

  // Billing items always go on the customer's bill.
  const addCharge = () =>
    setCharges((c) => [...c, { id: newChargeId(), label: "", amount: 0, bearer: "customer" }]);
  const patchCharge = (id: string, p: Partial<Charge>) =>
    setCharges((c) => c.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const removeCharge = (id: string) => setCharges((c) => c.filter((x) => x.id !== id));

  const draft = useMemo(
    () => ({
      ...row.raw,
      rate_basis: basis,
      sales_rate: Number(custRate || 0),
      customer_rate: Number(custRate || 0),
      customer_service_charge: Number(custServiceCharge || 0),
      seat_fee: Number(seatFee || 0),
      meal_fee: Number(mealFee || 0),
      fast_forward_fee: Number(baggageFee || 0),
      supplier_rate: Number(rate || 0),
      supplier_service_charge: Number(serviceCharge || 0),
      supplier_seat_fee: Number(supSeatFee || 0),
      supplier_meal_fee: Number(supMealFee || 0),
      supplier_fast_forward_fee: Number(supBaggageFee || 0),
      // recomputeService reads other_charges, so the supplier fees ride along there.
      other_charges_manual: Number(supSeatFee || 0) + Number(supMealFee || 0) + Number(supBaggageFee || 0),
      other_charges: Number(supSeatFee || 0) + Number(supMealFee || 0) + Number(supBaggageFee || 0),
    }),
    [
      row.raw,
      basis,
      custRate,
      custServiceCharge,
      seatFee,
      mealFee,
      baggageFee,
      rate,
      serviceCharge,
      supSeatFee,
      supMealFee,
      supBaggageFee,
    ],
  );

  const preview = useMemo(() => recomputeService(draft, numPax), [draft, numPax]);

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
      const picked = suppliers.find((s) => s.id === supplierId);
      const fields: Record<string, unknown> = {
        rate_basis: basis,
        sales_rate: Number(custRate || 0),
        customer_rate: Number(custRate || 0),
        customer_service_charge: Number(custServiceCharge || 0),
        seat_fee: Number(seatFee || 0),
        meal_fee: Number(mealFee || 0),
        fast_forward_fee: Number(baggageFee || 0),
        fee_note: feeNote,
        pnr: pnr.trim().toUpperCase() || null,
        remarks,
      };
      if (canSupplier) {
        fields.supplier_id = supplierId || null;
        fields.supplier_name = picked?.name ?? row.raw.supplier_name ?? null;
        fields.supplier_contact = picked?.mobile ?? picked?.contact_person ?? row.raw.supplier_contact ?? null;
        fields.supplier_rate = Number(rate || 0);
        fields.supplier_service_charge = Number(serviceCharge || 0);
        fields.supplier_seat_fee = Number(supSeatFee || 0);
        fields.supplier_meal_fee = Number(supMealFee || 0);
        fields.supplier_fast_forward_fee = Number(supBaggageFee || 0);
        fields.other_charges_manual = Number(supSeatFee || 0) + Number(supMealFee || 0) + Number(supBaggageFee || 0);
      }

      await post({ action: "update_service", rowId: row.rowId, fields });
      await post({ action: "set_charges", rowId: row.rowId, charges: charges.filter((c) => c.label.trim()) });
      if (alsoConfirm && row.status !== "Completed") {
        await post({ action: "complete_service", rowId: row.rowId });
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{row.kind}</p>
            <h2 className="text-xl font-semibold text-slate-800">Close service — {row.title}</h2>
            <p className="text-sm text-slate-500">
              {row.date ?? "—"} · {row.detail} · {row.city || "—"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* ---------- customer rate ---------- */}
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Customer rate</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500">Rate basis</span>
                <select
                  value={basis}
                  onChange={(e) => setBasis(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {RATE_BASES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Rate{basis === "per_pax" ? " (per pax)" : ""}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={custRate}
                  onChange={(e) => setCustomerRate(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500">Service charge</span>
                <input
                  type="number"
                  step="0.01"
                  value={custServiceCharge}
                  onChange={(e) => setCustomerServiceCharge(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
            </div>

            {row.kind === "flight" && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label>
                  <span className="mb-1 block text-xs font-medium text-slate-500">Seat fee</span>
                  <input
                    type="number"
                    step="0.01"
                    value={seatFee}
                    onChange={(e) => setSeat(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-slate-500">Meal fee</span>
                  <input
                    type="number"
                    step="0.01"
                    value={mealFee}
                    onChange={(e) => setMeal(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-slate-500">Baggage / fast forward</span>
                  <input
                    type="number"
                    step="0.01"
                    value={baggageFee}
                    onChange={(e) => setBaggage(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
              </div>
            )}

            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Note on fees (waivers, discounts, anything to explain on the bill)
              </span>
              <input
                value={feeNote}
                onChange={(e) => setFeeNote(e.target.value)}
                placeholder="e.g. seat fee waived for this passenger"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>

            {row.kind === "flight" && (
              <label className="mt-3 block sm:w-1/3">
                <span className="mb-1 block text-xs font-medium text-slate-500">PNR</span>
                <input
                  value={pnr}
                  onChange={(e) => setPnr(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none"
                />
              </label>
            )}

            {canSupplier && (
              <>
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={mirror} onChange={(e) => toggleMirror(e.target.checked)} />
                  Copy rate and fees to the supplier side
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Rate, seat, meal and baggage get copied. Your service charge stays on the customer side only.
                </p>
              </>
            )}
          </div>

          {/* ---------- supplier & cost ---------- */}
          {canSupplier && (
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Supplier & cost</h3>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Supplier</span>
                <select
                  value={supplierId}
                  onChange={(e) => chooseSupplier(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">— Select a supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.supplier_type ? ` · ${s.supplier_type}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-medium text-slate-500">Supplier rate</span>
                  <input
                    type="number"
                    step="0.01"
                    value={rate}
                    onChange={(e) => {
                      setMirror(false);
                      setRate(e.target.value);
                    }}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-slate-500">Service charge</span>
                  <input
                    type="number"
                    step="0.01"
                    value={serviceCharge}
                    onChange={(e) => {
                      setMirror(false);
                      setServiceCharge(e.target.value);
                    }}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
              </div>

              {row.kind === "flight" && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-500">Seat fee</span>
                    <input
                      type="number"
                      step="0.01"
                      value={supSeatFee}
                      onChange={(e) => {
                        setMirror(false);
                        setSupSeatFee(e.target.value);
                      }}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-500">Meal fee</span>
                    <input
                      type="number"
                      step="0.01"
                      value={supMealFee}
                      onChange={(e) => {
                        setMirror(false);
                        setSupMealFee(e.target.value);
                      }}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-500">Baggage / fast forward</span>
                    <input
                      type="number"
                      step="0.01"
                      value={supBaggageFee}
                      onChange={(e) => {
                        setMirror(false);
                        setSupBaggageFee(e.target.value);
                      }}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ---------- billing items ---------- */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Billing items</h3>
              <span className="text-sm text-slate-500">
                Total <span className="font-semibold text-slate-800">{inr(sumCharges(charges, "customer"))}</span>
              </span>
            </div>

            <div className="overflow-hidden rounded border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="w-48 px-3 py-2 font-semibold">Item</th>
                    <th className="px-3 py-2 font-semibold">Description</th>
                    <th className="w-28 px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {charges.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-5 text-center text-sm text-slate-500">
                        No billing items. Add extra bed, meal, seat, baggage, toll and anything else chargeable.
                      </td>
                    </tr>
                  )}
                  {charges.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <input
                          list="close-service-items"
                          value={c.label}
                          onChange={(e) => patchCharge(c.id, { label: e.target.value })}
                          placeholder="Select or type"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={c.remarks ?? ""}
                          onChange={(e) => patchCharge(c.id, { remarks: e.target.value })}
                          placeholder="Add description (optional)"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={c.amount || ""}
                          onChange={(e) => patchCharge(c.id, { amount: Number(e.target.value) })}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeCharge(c.id)}
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

            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={addCharge}
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
            </div>

            {files.length > 0 && <p className="mt-2 text-xs text-emerald-700">Attached: {files.join(", ")}</p>}
          </div>

          {/* ---------- remarks ---------- */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Remarks</span>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Anything the accounts team should know before billing"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          {/* ---------- totals ---------- */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded bg-slate-50 p-3 text-sm">
            <span className="text-slate-500">
              Selling <span className="font-semibold text-slate-800">{inr(preview.customer_selling_amount)}</span>
            </span>
            {canSupplier && (
              <>
                <span className="text-slate-500">
                  Supplier cost <span className="font-semibold text-slate-800">{inr(preview.total_supplier_cost)}</span>
                </span>
                <span className="text-slate-500">
                  Profit <span className="font-semibold text-emerald-700">{inr(preview.profit)}</span> ·{" "}
                  {Number(preview.margin).toFixed(1)}%
                </span>
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
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
