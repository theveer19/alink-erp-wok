"use client";

import { useState } from "react";
import { PageHeader, Section, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt, FileDown, Printer } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money } from "@/lib/utils";
import { toast } from "sonner";
import type { Invoice } from "@/lib/types";

const PAYCLR: Record<string, string> = {
  Paid: "bg-emerald-100 text-emerald-700",
  "Partially Paid": "bg-amber-100 text-amber-700",
  Unpaid: "bg-red-100 text-red-700",
};

export default function InvoicesClient({ initial, canEdit }: { initial: Invoice[]; canEdit: boolean }) {
  const [rows, setRows] = useState<Invoice[]>(initial);
  const [active, setActive] = useState<Invoice | null>(null);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [pay, setPay] = useState({ amount: "", mode: "Bank Transfer", reference: "" });
  const [payingNow, setPayingNow] = useState(false);

  const open = (i: Invoice) => { setActive(i); setNote(i.notes ?? ""); setPay({ amount: "", mode: "Bank Transfer", reference: "" }); };

  const recordPayment = async () => {
    if (!active) return;
    if (!Number(pay.amount)) { toast.error("Enter an amount"); return; }
    setPayingNow(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "customer",
          invoice_id: active.id,
          booking_id: active.booking_id,
          amount: pay.amount,
          mode: pay.mode,
          reference: pay.reference,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      // refresh the invoice to reflect new received/balance/status
      const fresh = await (await fetch(`/api/invoices/${active.id}`)).json();
      setActive(fresh);
      setRows((r) => r.map((x) => (x.id === fresh.id ? fresh : x)));
      setPay({ amount: "", mode: "Bank Transfer", reference: "" });
      toast.success("Payment recorded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record payment");
    } finally {
      setPayingNow(false);
    }
  };

  const saveNote = async () => {
    if (!active) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/invoices/${active.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: note }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Note saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save note");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" subtitle="Generated tax invoices and their payment status." />

      <Section>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-5 py-2.5 font-medium">Invoice #</th>
                <th className="px-5 py-2.5 font-medium">Booking</th>
                <th className="px-5 py-2.5 font-medium">Customer</th>
                <th className="px-5 py-2.5 font-medium text-right">Grand Total</th>
                <th className="px-5 py-2.5 font-medium text-right">Received</th>
                <th className="px-5 py-2.5 font-medium text-right">Balance</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((i) => (
                <tr key={i.id} className="cursor-pointer hover:bg-slate-50" onClick={() => open(i)}>
                  <td className="px-5 py-3 font-medium text-slate-900">{i.invoice_number}</td>
                  <td className="px-5 py-3 text-slate-500">{i.booking_number}</td>
                  <td className="px-5 py-3">{i.customer?.name}</td>
                  <td className="px-5 py-3 text-right tnum font-medium">{money(i.grand_total)}</td>
                  <td className="px-5 py-3 text-right tnum text-emerald-600">{money(i.amount_received)}</td>
                  <td className="px-5 py-3 text-right tnum text-red-600">{money(i.balance_due)}</td>
                  <td className="px-5 py-3"><Badge className={PAYCLR[i.status] || "bg-slate-100"}>{i.status}</Badge></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7}><EmptyState icon={<Receipt size={40} />} title="No invoices yet" subtitle="Invoices are generated from completed bookings." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between pr-6">
                  <span>{active.invoice_number}</span>
                  <Badge className={PAYCLR[active.status] || "bg-slate-100"}>{active.status}</Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bill To</div>
                <div className="font-semibold text-slate-900">{active.customer?.name}</div>
                {active.customer?.company && <div className="text-slate-600">{active.customer.company}</div>}
                {active.customer?.gst_number && <div className="text-slate-600">GSTIN: {active.customer.gst_number}</div>}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => window.open(`/api/invoices/${active.id}/pdf`, "_blank")}>
                  <FileDown size={15} /> View PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(`/api/invoices/${active.id}/pdf`, "_blank")}>
                  <Printer size={15} /> Print
                </Button>
              </div>

              <div className="border border-slate-200 rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-medium">Description</th>
                      <th className="px-4 py-2 font-medium text-right">Qty</th>
                      <th className="px-4 py-2 font-medium text-right">Rate</th>
                      <th className="px-4 py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {active.items?.map((it, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2">{it.description}</td>
                        <td className="px-4 py-2 text-right">{it.qty}</td>
                        <td className="px-4 py-2 text-right tnum">{money(it.rate)}</td>
                        <td className="px-4 py-2 text-right tnum">{money(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-sm space-y-1 text-slate-600 max-w-xs ml-auto w-full">
                <Line label="Subtotal" value={money(active.subtotal)} />
                <Line label="Service Charge" value={money(active.service_charge_total)} />
                <Line label="Discount" value={"- " + money(active.discount)} />
                <Line label={`GST (${active.tax_rate}% on ${active.gst_basis === "service_charge" ? "Service Charge" : "Total"})`} value={money(active.tax_amount)} />
                <div className="border-t pt-1"><Line label="Grand Total" value={money(active.grand_total)} bold /></div>
                <Line label="Received" value={money(active.amount_received)} className="text-emerald-600" />
                <Line label="Balance Due" value={money(active.balance_due)} className="text-red-600" bold />
              </div>

              {canEdit && active.balance_due > 0 && (
                <div className="rounded-md border border-slate-200 p-4 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Record Payment</div>
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="number"
                      value={pay.amount}
                      onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))}
                      placeholder="Amount"
                      className="h-10 px-3 rounded-md border border-input bg-white text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Select value={pay.mode} onValueChange={(v) => setPay((p) => ({ ...p, mode: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Bank Transfer", "UPI", "Cash", "Card", "Cheque"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <input
                      value={pay.reference}
                      onChange={(e) => setPay((p) => ({ ...p, reference: e.target.value }))}
                      placeholder="Reference"
                      className="h-10 px-3 rounded-md border border-input bg-white text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <Button size="sm" onClick={recordPayment} disabled={payingNow}>
                    {payingNow ? "Recording…" : "Record Payment"}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</div>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={!canEdit} placeholder="Add a note…" />
                {canEdit && <Button size="sm" variant="outline" onClick={saveNote} disabled={savingNote}>{savingNote ? "Saving…" : "Save Note"}</Button>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Line({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-slate-900" : ""} ${className ?? ""}`}>
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
