"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ServiceRow } from "@/lib/booking-actions";

/** Operations team jo tags roz use karti hai. Tenant settings me move kar sakte ho. */
const SUGGESTED = [
  "VIP",
  "Urgent",
  "Rate pending",
  "Awaiting supplier",
  "Amendment",
  "Refund pending",
  "Special meal",
  "Early check-in",
];

export function LabelDialog({
  row,
  onClose,
  onSave,
}: {
  row: ServiceRow;
  onClose: () => void;
  onSave: (labels: string[]) => void | Promise<void>;
}) {
  const [labels, setLabels] = useState<string[]>(row.labels ?? []);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (l: string) =>
    setLabels((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  const addCustom = () => {
    const v = custom.trim();
    if (v && !labels.includes(v)) setLabels((c) => [...c, v]);
    setCustom("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Labels</h2>
            <p className="text-sm text-slate-500">{row.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from(new Set([...SUGGESTED, ...labels])).map((l) => {
            const on = labels.includes(l);
            return (
              <button
                key={l}
                type="button"
                onClick={() => toggle(l)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  on
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 text-slate-600 hover:border-slate-400"
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="Naya label likho"
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={addCustom}
            className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Add
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(labels);
              setSaving(false);
            }}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save labels"}
          </button>
        </div>
      </div>
    </div>
  );
}
