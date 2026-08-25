"use client";

import { useMemo, useState } from "react";
import { PageHeader, Section, EmptyState, Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Plus } from "lucide-react";
import { money } from "@/lib/utils";
import { toast } from "sonner";
import type { Payment } from "@/lib/types";

const MODES = ["Bank Transfer", "UPI", "Cash", "Card", "Cheque"];

export default function PaymentsClient({
  initial, suppliers, bookings, canRecord,
}: {
  initial: Payment[];
  suppliers: { id: string; name: string }[];
  bookings: { id: string; booking_number: string }[];
  canRecord: boolean;
}) {
  const [rows, setRows] = useState<Payment[]>(initial);
  const [tab, setTab] = useState<"customer" | "supplier">("customer");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", booking_id: "", amount: "", mode: "Bank Transfer", reference: "" });

  const supplierName = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const bookingNo = useMemo(() => Object.fromEntries(bookings.map((b) => [b.id, b.booking_number])), [bookings]);

  const received = rows.filter((r) => r.type === "customer");
  const payouts = rows.filter((r) => r.type === "supplier");
  const list = tab === "customer" ? received : payouts;

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.supplier_id) return toast.error("Select a supplier");
    if (!Number(form.amount)) return toast.error("Enter an amount");
    setSaving(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "supplier", ...form }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created = await res.json();
      setRows((r) => [created, ...r]);
      setOpen(false);
      setForm({ supplier_id: "", booking_id: "", amount: "", mode: "Bank Transfer", reference: "" });
      toast.success("Supplier payment recorded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Customer receipts and supplier payouts."
        actions={canRecord && <Button onClick={() => setOpen(true)}><Plus size={16} /> Supplier Payment</Button>}
      />

      <div className="flex gap-2">
        <Button variant={tab === "customer" ? "default" : "outline"} size="sm" onClick={() => setTab("customer")}>
          Received ({received.length})
        </Button>
        <Button variant={tab === "supplier" ? "default" : "outline"} size="sm" onClick={() => setTab("supplier")}>
          Supplier Payouts ({payouts.length})
        </Button>
      </div>

      <Section>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-5 py-2.5 font-medium">{tab === "customer" ? "Booking" : "Supplier"}</th>
                <th className="px-5 py-2.5 font-medium">Mode</th>
                <th className="px-5 py-2.5 font-medium">Reference</th>
                <th className="px-5 py-2.5 font-medium">Recorded By</th>
                <th className="px-5 py-2.5 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-500">{(p.date || p.created_at || "").slice(0, 10)}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {tab === "customer" ? (bookingNo[p.booking_id || ""] || "—") : (supplierName[p.supplier_id || ""] || "—")}
                  </td>
                  <td className="px-5 py-3">{p.mode ? <Badge variant="outline">{p.mode}</Badge> : "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{p.reference || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{p.recorded_by || "—"}</td>
                  <td className="px-5 py-3 text-right tnum font-semibold text-emerald-600">{money(p.amount)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon={<Wallet size={40} />} title={`No ${tab === "customer" ? "receipts" : "payouts"} yet`} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Supplier Payment</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Supplier">
              <Select value={form.supplier_id} onValueChange={(v) => set("supplier_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Against Booking (optional)">
              <Select value={form.booking_id} onValueChange={(v) => set("booking_id", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {bookings.map((b) => <SelectItem key={b.id} value={b.id}>{b.booking_number}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount (₹)">
              <Input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </Field>
            <Field label="Mode">
              <Select value={form.mode} onValueChange={(v) => set("mode", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Reference" className="col-span-2">
              <Input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Txn ID / cheque no." />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Record Payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
