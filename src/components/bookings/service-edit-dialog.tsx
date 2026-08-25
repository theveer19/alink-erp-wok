"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { RATE_BASES, recomputeService } from "@/lib/bookings";
import { can, type ServiceRow } from "@/lib/booking-actions";
import type { Role } from "@/lib/types";

type F = { key: string; label: string; type?: "text" | "number" | "date" | "time" | "textarea" };

const FIELDS: Record<string, F[]> = {
  hotel: [
    { key: "hotel_name", label: "Hotel name" },
    { key: "room_type", label: "Room type" },
    { key: "city", label: "City" },
    { key: "address", label: "Address", type: "textarea" },
    { key: "check_in", label: "Check-in", type: "date" },
    { key: "check_out", label: "Check-out", type: "date" },
    { key: "check_in_time", label: "Check-in time", type: "time" },
    { key: "nights", label: "Nights", type: "number" },
    { key: "rooms", label: "Rooms", type: "number" },
    { key: "meal_plan", label: "Meal plan (CP/MAP/AP)" },
    { key: "lead_guest", label: "Lead guest" },
    { key: "confirmation_number", label: "Hotel confirmation no." },
  ],
  flight: [
    { key: "airline", label: "Airline" },
    { key: "flight_number", label: "Flight number" },
    { key: "from", label: "From (city/airport)" },
    { key: "to", label: "To (city/airport)" },
    { key: "departure_date", label: "Departure date", type: "date" },
    { key: "departure_time", label: "Departure time", type: "time" },
    { key: "arrival_date", label: "Arrival date", type: "date" },
    { key: "arrival_time", label: "Arrival time", type: "time" },
    { key: "class", label: "Class" },
    { key: "pnr", label: "PNR" },
    { key: "lead_passenger", label: "Lead passenger" },
  ],
  other: [
    { key: "service_name", label: "Service name" },
    { key: "service_type", label: "Service type" },
    { key: "service_date", label: "Date", type: "date" },
    { key: "service_time", label: "Time", type: "time" },
    { key: "city", label: "City" },
    { key: "pickup_address", label: "Pickup address", type: "textarea" },
    { key: "lead_passenger", label: "Lead passenger" },
  ],
};

const FLIGHT_FEES: F[] = [
  { key: "seat_fee", label: "Seat fee", type: "number" },
  { key: "meal_fee", label: "Meal fee", type: "number" },
  { key: "fast_forward_fee", label: "Fast forward / baggage", type: "number" },
];

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

interface SupplierOpt {
  id: string;
  name: string;
}

export function ServiceEditDialog({
  row,
  role,
  numPax,
  focus,
  onClose,
  onSave,
}: {
  row: ServiceRow;
  role: Role;
  numPax: number;
  /** "supplier" ya "extras" — dialog khulte hi wahi section highlight hota hai. */
  focus?: "supplier" | "extras" | null;
  onClose: () => void;
  onSave: (fields: Record<string, unknown>) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...row.raw });
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [saving, setSaving] = useState(false);

  const canCost = can(role, ["operations", "accounts"]);
  const fields = FIELDS[row.kind] ?? FIELDS.other;

  useEffect(() => {
    if (!canCost) return;
    let alive = true;
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((j) => {
        const list = Array.isArray(j) ? j : (j.data ?? j.suppliers ?? []);
        if (alive) setSuppliers(list.map((s: SupplierOpt) => ({ id: s.id, name: s.name })));
      })
      .catch(() => void 0);
    return () => {
      alive = false;
    };
  }, [canCost]);

  const set = (k: string, v: unknown) => setDraft((d) => ({ ...d, [k]: v }));

  // Live preview — wahi function jo server par chalta hai, isliye number match karta hai.
  const preview = useMemo(() => recomputeService(draft, numPax), [draft, numPax]);

  const input = (f: F) => {
    const v = draft[f.key];
    const common =
      "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
    if (f.type === "textarea")
      return (
        <textarea
          rows={2}
          value={String(v ?? "")}
          onChange={(e) => set(f.key, e.target.value)}
          className={common}
        />
      );
    return (
      <input
        type={f.type ?? "text"}
        step={f.type === "number" ? "0.01" : undefined}
        value={f.type === "date" ? String(v ?? "").slice(0, 10) : String(v ?? "")}
        onChange={(e) => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
        className={common}
      />
    );
  };

  const section = (title: string, highlight: boolean, children: React.ReactNode) => (
    <div className={`rounded-lg border p-4 ${highlight ? "border-blue-400 bg-blue-50/40" : "border-slate-200"}`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{row.kind}</p>
            <h2 className="text-lg font-semibold text-slate-800">{row.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {section(
            "Service details",
            false,
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <label key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                  <span className="mb-1 block text-xs font-medium text-slate-500">{f.label}</span>
                  {input(f)}
                </label>
              ))}
            </div>,
          )}

          {canCost &&
            section(
              "Supplier & cost",
              focus === "supplier",
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Supplier</span>
                  <select
                    value={String(draft.supplier_id ?? "")}
                    onChange={(e) => {
                      const s = suppliers.find((x) => x.id === e.target.value);
                      set("supplier_id", e.target.value || null);
                      set("supplier_name", s?.name ?? null);
                    }}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">— Supplier chuno —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                {[
                  { key: "supplier_booking_id", label: "Supplier booking ID" },
                  { key: "supplier_reference", label: "Supplier reference" },
                  { key: "supplier_rate", label: "Supplier rate", type: "number" as const },
                  { key: "supplier_service_charge", label: "Supplier service charge", type: "number" as const },
                  { key: "taxes", label: "Taxes", type: "number" as const },
                  { key: "other_charges_manual", label: "Other charges (manual)", type: "number" as const },
                ].map((f) => (
                  <label key={f.key}>
                    <span className="mb-1 block text-xs font-medium text-slate-500">{f.label}</span>
                    {input(f)}
                  </label>
                ))}
                <p className="text-xs text-slate-400 sm:col-span-2">
                  Charges dialog se add kiye gaye supplier charges apne aap "Other charges" me jud jaate hain.
                </p>
              </div>,
            )}

          {section(
            "Customer rate",
            focus === "extras",
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500">Rate basis</span>
                <select
                  value={String(draft.rate_basis ?? "flat")}
                  onChange={(e) => set("rate_basis", e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {RATE_BASES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
              {[
                { key: "sales_rate", label: "Sales rate (unit)", type: "number" as const },
                { key: "customer_rate", label: "Customer rate (flat)", type: "number" as const },
                { key: "customer_service_charge", label: "Customer service charge", type: "number" as const },
              ].map((f) => (
                <label key={f.key}>
                  <span className="mb-1 block text-xs font-medium text-slate-500">{f.label}</span>
                  {input(f)}
                </label>
              ))}
              {row.kind === "flight" &&
                FLIGHT_FEES.map((f) => (
                  <label key={f.key}>
                    <span className="mb-1 block text-xs font-medium text-slate-500">{f.label}</span>
                    {input(f)}
                  </label>
                ))}
            </div>,
          )}

          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Customer selling amount</span>
              <span className="font-semibold text-slate-800">
                {inr(Number(preview.customer_selling_amount))}
              </span>
            </div>
            {canCost && (
              <>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Supplier cost</span>
                  <span className="text-slate-800">{inr(Number(preview.total_supplier_cost))}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 py-1 pt-2">
                  <span className="text-slate-500">Profit / margin</span>
                  <span className="font-semibold text-emerald-700">
                    {inr(Number(preview.profit))} · {Number(preview.margin).toFixed(1)}%
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(draft);
              setSaving(false);
            }}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
