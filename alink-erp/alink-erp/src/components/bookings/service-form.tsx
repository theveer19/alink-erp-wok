"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recomputeService, RATE_BASES } from "@/lib/bookings";
import { money } from "@/lib/utils";

type Form = Record<string, string>;

const FIELDS: Record<string, { key: string; label: string; type?: string; full?: boolean }[]> = {
  hotel: [
    { key: "hotel_name", label: "Hotel Name" },
    { key: "city", label: "City" },
    { key: "checkin", label: "Check-in", type: "date" },
    { key: "checkout", label: "Check-out", type: "date" },
    { key: "room_category", label: "Room Category" },
    { key: "meal_plan", label: "Meal Plan" },
    { key: "confirmation_number", label: "Confirmation #" },
    { key: "nights", label: "Nights", type: "number" },
    { key: "rooms", label: "Rooms", type: "number" },
  ],
  flight: [
    { key: "airline", label: "Airline" },
    { key: "flight_number", label: "Flight Number" },
    { key: "pnr", label: "PNR" },
    { key: "origin", label: "Origin" },
    { key: "destination", label: "Destination" },
    { key: "departure_date", label: "Departure Date", type: "date" },
    { key: "departure_time", label: "Departure Time" },
  ],
  other: [
    { key: "service_type", label: "Service Type" },
    { key: "description", label: "Description", full: true },
  ],
};

export default function ServiceForm({
  stype,
  initial,
  numPax,
  canSeeCost,
  saving,
  onCancel,
  onSubmit,
}: {
  stype: "hotel" | "flight" | "other";
  initial?: Record<string, unknown> | null;
  numPax: number;
  canSeeCost: boolean;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const seed: Form = {};
  const keys = [
    ...FIELDS[stype].map((f) => f.key),
    "rate_basis", "sales_rate", "seat_fee", "fast_forward_fee", "meal_fee",
    "supplier_name", "supplier_rate", "supplier_service_charge", "taxes", "other_charges", "supplier_reference",
  ];
  for (const k of keys) seed[k] = initial?.[k] != null ? String(initial[k]) : "";
  if (!seed.rate_basis) seed.rate_basis = "flat";

  const [form, setForm] = useState<Form>(seed);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const preview = useMemo(() => recomputeService(form, numPax), [form, numPax]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {FIELDS[stype].map((f) => (
          <Field key={f.key} label={f.label} className={f.full ? "col-span-2" : ""}>
            {f.full ? (
              <Textarea value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <Input type={f.type || "text"} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </Field>
        ))}
      </div>

      <div className="rounded-md bg-slate-50 border border-slate-200 p-4 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selling</div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rate Basis">
            <Select value={form.rate_basis} onValueChange={(v) => set("rate_basis", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RATE_BASES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Sales Rate (₹)">
            <Input type="number" value={form.sales_rate} onChange={(e) => set("sales_rate", e.target.value)} />
          </Field>
          {stype === "flight" && (
            <>
              <Field label="Seat Fee (₹)">
                <Input type="number" value={form.seat_fee} onChange={(e) => set("seat_fee", e.target.value)} />
              </Field>
              <Field label="Fast Forward Fee (₹)">
                <Input type="number" value={form.fast_forward_fee} onChange={(e) => set("fast_forward_fee", e.target.value)} />
              </Field>
              <Field label="Meal Fee (₹)">
                <Input type="number" value={form.meal_fee} onChange={(e) => set("meal_fee", e.target.value)} />
              </Field>
            </>
          )}
        </div>
      </div>

      {canSeeCost && (
        <div className="rounded-md bg-slate-50 border border-slate-200 p-4 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier Cost</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Supplier Name">
              <Input value={form.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} />
            </Field>
            <Field label="Supplier Reference">
              <Input value={form.supplier_reference} onChange={(e) => set("supplier_reference", e.target.value)} />
            </Field>
            <Field label="Supplier Rate (₹)">
              <Input type="number" value={form.supplier_rate} onChange={(e) => set("supplier_rate", e.target.value)} />
            </Field>
            <Field label="Supplier Service Charge (₹)">
              <Input type="number" value={form.supplier_service_charge} onChange={(e) => set("supplier_service_charge", e.target.value)} />
            </Field>
            <Field label="Taxes (₹)">
              <Input type="number" value={form.taxes} onChange={(e) => set("taxes", e.target.value)} />
            </Field>
            <Field label="Other Charges (₹)">
              <Input type="number" value={form.other_charges} onChange={(e) => set("other_charges", e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 rounded-md bg-slate-900 text-white p-4">
        <Stat label="Selling" value={money(Number(preview.customer_selling_amount))} />
        {canSeeCost && <Stat label="Supplier Cost" value={money(Number(preview.total_supplier_cost))} />}
        {canSeeCost && <Stat label="Profit" value={money(Number(preview.profit))} tone="emerald" />}
        {canSeeCost && <Stat label="Margin" value={`${preview.margin ?? 0}%`} tone="emerald" />}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={saving}>{saving ? "Saving…" : "Save Service"}</Button>
      </DialogFooter>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" }) {
  return (
    <div className="flex-1 min-w-[110px]">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-lg font-bold tnum ${tone === "emerald" ? "text-emerald-400" : "text-white"}`}>{value}</div>
    </div>
  );
}
