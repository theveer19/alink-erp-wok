"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Plus, Trash2 } from "lucide-react";
import { recomputeService } from "@/lib/bookings";
import { CHARGE_PRESETS, newChargeId, readCharges, sumCharges, type Charge } from "@/lib/booking-charges";
import type { ServiceRow } from "@/lib/booking-actions";

interface Supplier {
  id: string;
  name: string;
  supplier_type?: string | null;
  contact_person?: string | null;
  mobile?: string | null;
  email?: string | null;
  payment_terms?: string | null;
  default_rate?: number | null;
  default_service_charge?: number | null;
}

const inr = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * One-screen allotment: read the service, pick a supplier, rates fill in from the
 * supplier master, assign — and optionally send the request in the same click.
 */
export function AllotDialog({
  row,
  bookingId,
  numPax,
  onClose,
  onDone,
}: {
  row: ServiceRow;
  bookingId: string;
  numPax: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [pickedId, setPickedId] = useState<string>(String(row.raw.supplier_id ?? ""));
  const [rate, setRate] = useState(String(row.raw.supplier_rate ?? ""));
  const [serviceCharge, setServiceCharge] = useState(String(row.raw.supplier_service_charge ?? ""));
  const [taxes, setTaxes] = useState(String(row.raw.taxes ?? ""));
  const [notify, setNotify] = useState(true);
  // Rates are usually already on the service — keep them tucked away.
  const [showRates, setShowRates] = useState(false);
  const [charges, setCharges] = useState<Charge[]>(readCharges(row.raw));

  const addCharge = () =>
    setCharges((c) => [...c, { id: newChargeId(), label: "", amount: 0, bearer: "customer" }]);
  const patchCharge = (id: string, p: Partial<Charge>) =>
    setCharges((c) => c.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const removeCharge = (id: string) => setCharges((c) => c.filter((x) => x.id !== id));

  useEffect(() => {
    let alive = true;
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((j) => {
        const list: Supplier[] = Array.isArray(j) ? j : (j.data ?? j.suppliers ?? []);
        if (alive) setSuppliers(list);
      })
      .catch(() => alive && setError("Could not load suppliers"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const picked = suppliers.find((s) => s.id === pickedId) ?? null;

  // Picking a supplier pulls its default rates in, so nothing has to be typed twice.
  function choose(s: Supplier) {
    setPickedId(s.id);
    if (!Number(rate) && s.default_rate) setRate(String(s.default_rate));
    if (!Number(serviceCharge) && s.default_service_charge) setServiceCharge(String(s.default_service_charge));
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return suppliers;
    return suppliers.filter((s) =>
      [s.name, s.supplier_type ?? "", s.contact_person ?? "", s.mobile ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [suppliers, q]);

  const preview = useMemo(
    () =>
      recomputeService(
        {
          ...row.raw,
          supplier_rate: Number(rate || 0),
          supplier_service_charge: Number(serviceCharge || 0),
          taxes: Number(taxes || 0),
        },
        numPax,
      ),
    [row.raw, rate, serviceCharge, taxes, numPax],
  );

  async function assign() {
    if (!picked) return;
    setSaving(true);
    setError(null);
    try {
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

      await post({
        action: "update_service",
        rowId: row.rowId,
        fields: {
          supplier_id: picked.id,
          supplier_name: picked.name,
          supplier_contact: picked.mobile ?? picked.contact_person ?? null,
          supplier_rate: Number(rate || 0),
          supplier_service_charge: Number(serviceCharge || 0),
          taxes: Number(taxes || 0),
        },
      });

      const cleanCharges = charges.filter((c) => c.label.trim());
      if (cleanCharges.length || readCharges(row.raw).length) {
        await post({ action: "set_charges", rowId: row.rowId, charges: cleanCharges });
      }

      if (notify) await post({ action: "request_supplier", rowId: row.rowId });

      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign supplier");
      setSaving(false);
    }
  }

  const summary: [string, string, string, string][] =
    row.kind === "hotel"
      ? [
          ["Hotel", row.title, "Status", row.status],
          ["Check-in", `${row.date ?? "—"} ${row.time ?? ""}`, "Check-out", row.endDate ?? "—"],
          ["City", row.city || "—", "Occupancy", row.detail],
          ["Address", row.address || "—", "Guest", row.passenger || "—"],
        ]
      : [
          ["Flight", row.title, "Status", row.status],
          ["Departure", `${row.date ?? "—"} ${row.time ?? ""}`, "Class", row.detail],
          ["Sector", row.address || "—", "City", row.city || "—"],
          ["Passenger", row.passenger || "—", "Pax", String(numPax)],
        ];

  return (
    <div className="fixed inset-0 z-[900] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <div className="my-6 w-full max-w-3xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Allot service</h2>
            <p className="text-sm text-slate-500">Pick a supplier — rates fill in automatically</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          {/* ---- service summary ---- */}
          <table className="mb-5 w-full border-collapse overflow-hidden rounded border border-slate-200 text-sm">
            <tbody>
              {summary.map(([l1, v1, l2, v2], i) => (
                <tr key={i} className={i % 2 ? "bg-slate-50" : ""}>
                  <th className="w-32 border-r border-slate-100 px-3 py-2 text-left font-semibold text-slate-600">
                    {l1}
                  </th>
                  <td className="border-r border-slate-100 px-3 py-2 text-slate-800">{v1}</td>
                  <th className="w-32 border-r border-slate-100 px-3 py-2 text-left font-semibold text-slate-600">
                    {l2}
                  </th>
                  <td className="px-3 py-2 text-slate-800">{v2}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ---- supplier picker ---- */}
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-700">My suppliers</h3>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search supplier…"
              className="ml-auto w-56 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="max-h-60 overflow-y-auto rounded border border-slate-200">
            {loading && <p className="p-4 text-sm text-slate-500">Loading suppliers…</p>}
            {!loading && filtered.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No suppliers found. Add one under Suppliers.</p>
            )}
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => choose(s)}
                className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left last:border-0 ${
                  pickedId === s.id ? "bg-blue-50" : "hover:bg-slate-50"
                }`}
              >
                <span
                  className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                    pickedId === s.id ? "border-blue-600 bg-blue-600" : "border-slate-300"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-800">{s.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {[s.supplier_type, s.contact_person, s.mobile, s.payment_terms].filter(Boolean).join(" · ") ||
                      "No contact details"}
                  </span>
                </span>
                {s.default_rate ? (
                  <span className="shrink-0 text-xs text-slate-500">Default {inr(s.default_rate)}</span>
                ) : null}
              </button>
            ))}
          </div>

          {/* ---- rates (optional) ---- */}
          <button
            type="button"
            onClick={() => setShowRates((v) => !v)}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            {showRates ? "Hide supplier rates" : "Supplier rates (optional — filled from the supplier master)"}
          </button>

          <div className={`mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3 ${showRates ? "" : "hidden"}`}>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Supplier rate</span>
              <input
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Service charge</span>
              <input
                type="number"
                step="0.01"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Taxes</span>
              <input
                type="number"
                step="0.01"
                value={taxes}
                onChange={(e) => setTaxes(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          </div>

          {/* ---- charges ---- */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Charges</h3>
              <span className="text-sm text-slate-500">
                Customer <span className="font-semibold text-slate-800">{inr(sumCharges(charges, "customer"))}</span>
                {" · "}Supplier{" "}
                <span className="font-semibold text-slate-800">{inr(sumCharges(charges, "supplier"))}</span>
              </span>
            </div>

            <div className="overflow-hidden rounded border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="w-48 px-3 py-2 font-semibold">Item</th>
                    <th className="px-3 py-2 font-semibold">Description</th>
                    <th className="w-28 px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="w-36 px-3 py-2 font-semibold">Billed to</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {charges.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500">
                        No charges. Add extra bed, meal, seat, baggage, toll and anything else billable.
                      </td>
                    </tr>
                  )}
                  {charges.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <input
                          list="allot-charge-presets"
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
                      <td className="px-3 py-2">
                        <select
                          value={c.bearer}
                          onChange={(e) => patchCharge(c.id, { bearer: e.target.value as Charge["bearer"] })}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                        >
                          <option value="customer">Customer</option>
                          <option value="supplier">Supplier cost</option>
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeCharge(c.id)}
                          aria-label="Remove charge"
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

            <datalist id="allot-charge-presets">
              {CHARGE_PRESETS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>

            <button
              type="button"
              onClick={addCharge}
              className="mt-2 inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> Add charge
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 rounded bg-slate-50 p-3 text-sm">
            <span className="text-slate-500">
              Supplier cost <span className="font-semibold text-slate-800">{inr(preview.total_supplier_cost)}</span>
            </span>
            <span className="text-slate-500">
              Selling <span className="font-semibold text-slate-800">{inr(preview.customer_selling_amount)}</span>
            </span>
            <span className="text-slate-500">
              Profit <span className="font-semibold text-emerald-700">{inr(preview.profit)}</span> ·{" "}
              {Number(preview.margin).toFixed(1)}%
            </span>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Mark as sent to supplier after assigning
          </label>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !picked}
            onClick={assign}
            className="rounded bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Allotting…" : "Allot"}
          </button>
        </div>
      </div>
    </div>
  );
}
