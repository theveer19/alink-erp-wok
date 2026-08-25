"use client";

import { X } from "lucide-react";
import { can, type ServiceRow } from "@/lib/booking-actions";
import { SUPPLIER_FIELDS } from "@/lib/bookings";
import type { Role } from "@/lib/types";

const HIDE = new Set(["labels", "status"]);

function pretty(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ServiceDetailDrawer({
  row,
  role,
  onClose,
}: {
  row: ServiceRow;
  role: Role;
  onClose: () => void;
}) {
  const salesBlind = !can(role, ["operations", "accounts"]);
  const supplierSet = new Set<string>([...SUPPLIER_FIELDS, "profit", "margin", "markup"]);

  const entries = Object.entries(row.raw).filter(([k, v]) => {
    if (HIDE.has(k)) return false;
    if (salesBlind && supplierSet.has(k)) return false;
    return v !== null && v !== undefined && v !== "";
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{row.kind}</p>
            <h2 className="text-lg font-semibold text-slate-800">{row.title}</h2>
            <p className="text-sm text-slate-500">
              {row.date ?? "—"} {row.endDate && row.endDate !== row.date ? `→ ${row.endDate}` : ""} · {row.city || "—"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <dl className="mt-5 divide-y divide-slate-100">
          {entries.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2 text-sm">
              <dt className="text-slate-500">{pretty(k)}</dt>
              <dd className="text-right text-slate-800">
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </dd>
            </div>
          ))}
          {entries.length === 0 && <p className="py-4 text-sm text-slate-500">Is service me abhi details nahi bhari.</p>}
        </dl>

        {salesBlind && (
          <p className="mt-4 rounded bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Supplier cost aur profit sirf operations, accounts aur admin ko dikhte hain.
          </p>
        )}
      </aside>
    </div>
  );
}
