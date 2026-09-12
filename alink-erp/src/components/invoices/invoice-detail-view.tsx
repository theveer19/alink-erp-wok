"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Printer, Trash2 } from "lucide-react";
import { can } from "@/lib/booking-actions";
import type { Invoice, Role } from "@/lib/types";

const inr = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

interface PaymentRow {
  id: string;
  amount: number;
  mode: string | null;
  reference: string | null;
  date: string | null;
  recorded_by: string | null;
  type: string;
}

export function InvoiceDetailView({ invoice, role }: { invoice: Invoice; role: Role }) {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [bills, setBills] = useState<{ id: string; name: string; url: string | null; category: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    if (!invoice.booking_id) return;
    try {
      const res = await fetch(`/api/bookings/${invoice.booking_id}/files`);
      const j = await res.json();
      if (res.ok) setBills(j.files ?? []);
    } catch {
      /* attachments are optional */
    }
  }, [invoice.booking_id]);

  const load = useCallback(async () => {
    if (!invoice.booking_id) return;
    try {
      const res = await fetch(`/api/bookings/${invoice.booking_id}/payments`);
      const j = await res.json();
      if (res.ok) setPayments((j.payments ?? []).filter((p: PaymentRow) => p.type === "customer"));
    } catch {
      /* payments are optional */
    }
  }, [invoice.booking_id]);

  useEffect(() => {
    load();
    loadFiles();
  }, [load, loadFiles]);

  async function cancelInvoice() {
    if (!invoice.booking_id) return;
    if (!confirm(`Invoice ${invoice.invoice_number} — remove this? The booking will become editable again.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${invoice.booking_id}/invoice`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Delete fail");
      router.push(`/bookings/${invoice.booking_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete fail");
      setBusy(false);
    }
  }

  const cust = invoice.customer as (typeof invoice.customer & { contact_person?: string | null }) | null;
  const contactPerson =
    cust?.contact_person && cust.contact_person !== (cust.company || cust.name) ? cust.contact_person : null;

  let srNo = 0;

  // Round off is whatever the stored grand total gained over the computed figure.
  const computed =
    Number(invoice.subtotal ?? 0) - Number(invoice.discount ?? 0) + Number(invoice.tax_amount ?? 0);
  const roundOff = Number(invoice.grand_total ?? 0) - computed;
  const halfTax = Number(invoice.tax_amount ?? 0) / 2;
  const halfRate = Number(invoice.tax_rate ?? 0) / 2;

  const statusColor =
    invoice.status === "Paid"
      ? "bg-emerald-100 text-emerald-700"
      : invoice.status === "Partially Paid"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-600";

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @media print {
          /* Hide the app shell — only the invoice sheet should print. */
          header, nav, footer.app-footer, .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
          body { background: #fff !important; }
          @page { margin: 14mm; size: A4; }
        }
      `}</style>

      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
        <div className="no-print mb-5 flex flex-wrap items-center gap-3">
          <Link
            href="/invoices"
            aria-label="Back"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-semibold text-slate-800">Invoice {invoice.invoice_number}</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>{invoice.status}</span>

          <div className="ml-auto flex gap-2">
            {invoice.booking_id && (
              <Link
                href={`/bookings/${invoice.booking_id}`}
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Open booking
              </Link>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Printer className="h-4 w-4" /> Print / PDF
            </button>
            {can(role, ["accounts"]) && (
              <button
                type="button"
                disabled={busy}
                onClick={cancelInvoice}
                className="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="no-print mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* ---------- printable invoice ---------- */}
        <div className="rounded-lg border border-slate-200 p-8 print:border-0 print:p-0">
          <header className="mb-6 flex items-start justify-between border-b-2 border-slate-800 pb-3">
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-wide text-slate-800">Tax Invoice</h2>
              <p className="text-sm text-slate-500">{invoice.invoice_number}</p>
            </div>
            <div className="text-right text-sm text-slate-600">
              <p>Date: {String(invoice.invoice_date ?? "").slice(0, 10)}</p>
              {invoice.booking_number && <p>Booking: {invoice.booking_number}</p>}
            </div>
          </header>

          <section className="mb-6">
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Bill to</h3>
            <p className="text-base font-semibold text-slate-800">
              {invoice.customer?.company || invoice.customer?.name || "—"}
            </p>
            {contactPerson && <p className="text-sm text-slate-600">Attn: {contactPerson}</p>}
            {invoice.customer?.address && <p className="text-sm text-slate-600">{invoice.customer.address}</p>}
            {invoice.customer?.mobile && <p className="text-sm text-slate-600">{invoice.customer.mobile}</p>}
            {invoice.customer?.email && <p className="text-sm text-slate-600">{invoice.customer.email}</p>}
            {invoice.customer?.gst_number && (
              <p className="text-sm text-slate-600">GSTIN: {invoice.customer.gst_number}</p>
            )}
          </section>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-slate-200 text-left">
                <th className="w-10 py-2 font-semibold text-slate-600">Sr.</th>
                <th className="py-2 font-semibold text-slate-600">Description</th>
                <th className="w-16 py-2 text-right font-semibold text-slate-600">Qty</th>
                <th className="w-28 py-2 text-right font-semibold text-slate-600">Rate</th>
                <th className="w-28 py-2 text-right font-semibold text-slate-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items ?? []).map((it, i) => {
                // Indentation carries the hierarchy: service, then passenger, then add-on.
                const deep = it.description.startsWith("      ");
                const sub = !deep && it.description.startsWith("   ");
                const head = !deep && !sub;
                if (head) srNo += 1;
                const blank = Number(it.amount) === 0;
                return (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 align-top text-slate-500">{head ? srNo : ""}</td>
                    <td
                      className={`py-2 pr-2 ${
                        deep
                          ? "pl-10 text-slate-500"
                          : sub
                            ? `pl-6 ${blank ? "text-slate-500" : "text-slate-700"}`
                            : "font-semibold text-slate-800"
                      }`}
                    >
                      {it.description.trim()}
                    </td>
                    <td className="py-2 text-right text-slate-600">{blank ? "" : it.qty}</td>
                    <td className="py-2 text-right text-slate-600">{blank ? "" : inr(it.rate)}</td>
                    <td className={`py-2 text-right ${head ? "font-medium text-slate-800" : "text-slate-600"}`}>
                      {blank ? "" : inr(it.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 ml-auto w-72 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-800">{inr(invoice.subtotal)}</span>
            </div>
            {Number(invoice.discount) > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Discount</span>
                <span className="text-slate-800">− {inr(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 py-1 pt-2">
              <span className="font-medium text-slate-600">Taxable sub total</span>
              <span className="font-medium text-slate-800">
                {inr(Number(invoice.subtotal ?? 0) - Number(invoice.discount ?? 0))}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">CGST @ {halfRate}%</span>
              <span className="text-slate-800">{inr(halfTax)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">SGST @ {halfRate}%</span>
              <span className="text-slate-800">{inr(halfTax)}</span>
            </div>
            {Math.abs(roundOff) >= 0.005 && (
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Round off</span>
                <span className="text-slate-800">{roundOff > 0 ? "+" : "−"} {inr(Math.abs(roundOff))}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-300 py-2 text-base">
              <span className="font-semibold text-slate-700">Grand total</span>
              <span className="font-bold text-slate-900">{inr(invoice.grand_total)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Received</span>
              <span className="text-emerald-700">{inr(invoice.amount_received)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Balance due</span>
              <span className="font-semibold text-slate-900">{inr(invoice.balance_due)}</span>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Tax classification: Sales Taxable — {invoice.tax_rate}%
            {invoice.gst_basis === "service_charge" ? " on service charge" : ""}
          </p>

          {invoice.notes && (
            <section className="mt-6">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Notes</h3>
              <p className="text-sm text-slate-700">{invoice.notes}</p>
            </section>
          )}
          {invoice.terms && (
            <section className="mt-3">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Terms</h3>
              <p className="text-sm text-slate-700">{invoice.terms}</p>
            </section>
          )}

          <footer className="mt-10 border-t border-slate-200 pt-3 text-center text-xs text-slate-400">
            This is a computer generated invoice.
          </footer>
        </div>

        {/* ---------- supporting bills (screen only) ---------- */}
        <div className="no-print mt-6 rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Supporting bills & vouchers</h3>
          {bills.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing attached to this booking.</p>
          ) : (
            <ul className="space-y-1">
              {bills.map((f) => (
                <li key={f.id} className="text-sm">
                  {f.url ? (
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {f.name}
                    </a>
                  ) : (
                    <span className="text-slate-700">{f.name}</span>
                  )}
                  <span className="ml-2 text-xs text-slate-400">{f.category}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Open a file and print it alongside the invoice when the customer asks for proof.
          </p>
        </div>

        {/* ---------- payments (screen only) ---------- */}
        <div className="no-print mt-6 rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Payments received</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No payments recorded yet.{" "}
              {invoice.booking_id && (
                <Link href={`/bookings/${invoice.booking_id}`} className="text-blue-600 hover:underline">
                  Add a receipt from the booking
                </Link>
              )}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between py-2 text-sm">
                  <span className="text-slate-600">
                    {p.date?.slice(0, 10)} · {p.mode ?? "—"}
                    {p.reference ? ` · ${p.reference}` : ""}
                    <span className="ml-2 text-xs text-slate-400">{p.recorded_by}</span>
                  </span>
                  <span className="font-semibold text-emerald-700">{inr(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
