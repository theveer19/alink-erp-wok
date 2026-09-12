"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
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
 * One job only: attach a supplier to the service.
 * Rates and charges are handled from the row menu once they're known.
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

  async function assign() {
    if (!picked) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_service",
          rowId: row.rowId,
          fields: {
            supplier_id: picked.id,
            supplier_name: picked.name,
            supplier_contact: picked.mobile ?? picked.contact_person ?? null,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not assign supplier");
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
            <p className="text-sm text-slate-500">Pick the supplier for this service</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5">
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

          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-700">My suppliers</h3>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search supplier…"
              className="ml-auto w-56 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded border border-slate-200">
            {loading && <p className="p-4 text-sm text-slate-500">Loading suppliers…</p>}
            {!loading && filtered.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No suppliers found. Add one under Suppliers.</p>
            )}
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setPickedId(s.id)}
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
