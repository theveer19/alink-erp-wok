"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload, X } from "lucide-react";
import { can, type ServiceRow } from "@/lib/booking-actions";
import type { Role } from "@/lib/types";

interface FileRow {
  id: string;
  name: string;
  size: number;
  type: string;
  category: string;
  ref: string | null;
  amount: number | null;
  uploaded_by: string;
  uploaded_at: string;
  url: string | null;
}

const CATEGORIES = [
  { value: "supplier_bill", label: "Supplier bill / invoice", opsOnly: true },
  { value: "voucher", label: "Hotel voucher" },
  { value: "ticket", label: "Flight ticket / PNR" },
  { value: "customer_receipt", label: "Customer payment receipt" },
  { value: "other", label: "Other document" },
] as const;

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export function AttachmentsDialog({
  bookingId,
  row,
  role,
  onClose,
  onChanged,
}: {
  bookingId: string;
  /** null = documents for the whole booking; pass a row for one service only. */
  row: ServiceRow | null;
  role: Role;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(
    row?.kind === "flight" ? "ticket" : row?.kind === "hotel" ? "voucher" : "other",
  );
  const [amount, setAmount] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const canDelete = can(role, ["operations", "accounts"]);
  const canSupplierBill = can(role, ["operations", "accounts"]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/files`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load files");
      const all = (json.files ?? []) as FileRow[];
      setFiles(row ? all.filter((f) => f.ref === row.rowId) : all);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [bookingId, row]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      if (row) fd.append("ref", row.rowId);
      if (amount) fd.append("amount", amount);

      const res = await fetch(`/api/bookings/${bookingId}/files`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload fail");
      setAmount("");
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload fail");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(fileId: string) {
    if (!confirm("Delete this file?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete fail");
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete fail");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {row ? "Bills & documents" : "Booking documents"}
            </h2>
            <p className="text-sm text-slate-500">{row ? row.title : "Files for the whole booking"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-xs font-medium text-slate-500">Document type</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {CATEGORIES.filter((c) => !("opsOnly" in c && c.opsOnly) || canSupplierBill).map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="w-40">
              <span className="mb-1 block text-xs font-medium text-slate-500">Amount (optional)</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>

            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {busy ? "Uploading…" : "Upload file"}
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <p className="mt-2 text-xs text-slate-400">JPG, PNG, WEBP ya PDF · max 10 MB</p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {!loading && files.length === 0 && (
            <p className="rounded border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
              No files uploaded yet.
            </p>
          )}

          <ul className="divide-y divide-slate-100">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-3">
                <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm font-medium text-blue-600 hover:underline"
                    >
                      {f.name}
                    </a>
                  ) : (
                    <span className="block truncate text-sm text-slate-700">{f.name}</span>
                  )}
                  <p className="text-xs text-slate-400">
                    {CATEGORIES.find((c) => c.value === f.category)?.label ?? f.category} · {kb(f.size)}
                    {f.amount ? ` · ₹${f.amount.toLocaleString("en-IN")}` : ""} · {f.uploaded_by} ·{" "}
                    {f.uploaded_at.slice(0, 10)}
                  </p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    aria-label={`Delete ${f.name}`}
                    className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
