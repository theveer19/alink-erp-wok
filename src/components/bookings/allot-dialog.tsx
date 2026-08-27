"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { recomputeService } from "@/lib/bookings";
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

          {/* ---- rates ---- */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
