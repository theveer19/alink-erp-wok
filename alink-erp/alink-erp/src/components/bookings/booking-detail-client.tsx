"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, Section, EmptyState } from "@/components/common";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ServiceForm from "@/components/bookings/service-form";
import { money } from "@/lib/utils";
import { BOOKING_STATUSES } from "@/lib/bookings";
import { toast } from "sonner";
import { ArrowLeft, Bed, Plane, Sparkles, Pencil, Trash2, Plus, CheckCircle2, Lock, Clock, FileDown, Receipt } from "lucide-react";
import type { Booking, Role, BookingFinancialsT } from "@/lib/types";

type SType = "hotel" | "flight" | "other";
const KEY: Record<SType, "hotels" | "flights" | "others"> = { hotel: "hotels", flight: "flights", other: "others" };

export default function BookingDetailClient({
  initial,
  role,
  canEdit,
  numPax,
}: {
  initial: Booking;
  role: Role;
  canEdit: boolean;
  numPax: number;
}) {
  const [b, setB] = useState<Booking>(initial);
  const [dialog, setDialog] = useState<{ stype: SType; service: Record<string, unknown> | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const canSeeCost = role !== "sales";
  const fin = (b.financials ?? { total_sales: 0 }) as BookingFinancialsT;
  const cust = b.customer_snapshot ?? {};

  const call = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return (await res.json()) as Booking;
  };

  const submitService = async (payload: Record<string, unknown>) => {
    if (!dialog) return;
    setSaving(true);
    try {
      const sid = dialog.service?.sid as string | undefined;
      const url = sid
        ? `/api/bookings/${b.id}/services/${dialog.stype}/${sid}`
        : `/api/bookings/${b.id}/services/${dialog.stype}`;
      const updated = await call(url, sid ? "PUT" : "POST", payload);
      setB(updated);
      setDialog(null);
      toast.success(sid ? "Service updated" : "Service added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save service");
    } finally {
      setSaving(false);
    }
  };

  const removeService = async (stype: SType, sid: string) => {
    if (!confirm("Remove this service?")) return;
    try {
      const updated = await call(`/api/bookings/${b.id}/services/${stype}/${sid}`, "DELETE");
      setB(updated);
      toast.success("Service removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove service");
    }
  };

  const confirmService = async (stype: SType, sid: string) => {
    try {
      const updated = await call(`/api/bookings/${b.id}/services/${stype}/${sid}/confirm`, "POST");
      setB(updated);
      toast.success("Service confirmed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm");
    }
  };

  const action = async (path: string, okMsg: string, body?: unknown) => {
    try {
      const updated = await call(`/api/bookings/${b.id}/${path}`, "POST", body);
      setB(updated);
      toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  const isOps = ["operations", "admin", "super_admin"].includes(role);
  const isAdmin = role === "admin" || role === "super_admin";
  const isAccounts = role === "accounts";
  const closed = ["Completed", "Closed"].includes(b.status);
  const canGenerateInvoice = (isAccounts || isAdmin) && !b.invoice_id;

  // Once completed/closed or invoiced, the booking is frozen — no add/edit/delete of services.
  // Admin can still reopen (which unlocks). This is what makes a completed booking non-deletable.
  const locked = closed || !!b.invoice_id;
  const canModify = canEdit && !locked;

  const [invOpen, setInvOpen] = useState(false);
  const [invForm, setInvForm] = useState({ discount: "", tax_rate: "18", gst_basis: "total" });
  const [invSaving, setInvSaving] = useState(false);

  const generateInvoice = async () => {
    setInvSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: b.id, ...invForm }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const inv = await res.json();
      // refresh booking to reflect Invoice Generated status + invoice_id
      const fresh = await call(`/api/bookings/${b.id}`, "GET");
      setB(fresh);
      setInvOpen(false);
      toast.success(`Invoice ${inv.invoice_number} generated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate invoice");
    } finally {
      setInvSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/bookings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Back to bookings
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-slate-900">{b.booking_number}</h1>
            <StatusBadge status={b.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {cust.name} · {b.destination || "—"} · {(b.travel_start_date || "").slice(0, 10)} → {(b.travel_end_date || "").slice(0, 10)}
          </p>
        </div>
        <div className="flex gap-2">
          {canGenerateInvoice && (
            <Button onClick={() => setInvOpen(true)}>
              <Receipt size={15} /> Generate Invoice
            </Button>
          )}
          {b.invoice_id && (
            <Button variant="outline" onClick={() => window.open(`/api/invoices/${b.invoice_id}/pdf`, "_blank")}>
              <Receipt size={15} /> Invoice PDF
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => window.open(`/api/bookings/${b.id}/voucher.pdf`, "_blank")}
          >
            <FileDown size={15} /> Voucher (PDF)
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Stat label="Total Sales" value={money(fin.total_sales)} />
        {canSeeCost && <Stat label="Supplier Cost" value={money(fin.total_supplier_cost)} />}
        {canSeeCost && <Stat label="Gross Profit" value={money(fin.gross_profit)} tone="emerald" />}
        {canSeeCost && <Stat label="Margin" value={`${fin.margin ?? 0}%`} tone="emerald" />}
      </div>

      {locked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock size={15} />
          {b.invoice_id
            ? "This booking is locked because an invoice has been generated. It cannot be edited or deleted."
            : "This booking is completed and locked. It cannot be edited or deleted."}
          {isAdmin && " Reopen it below to make changes."}
        </div>
      )}

      {(isOps || isAccounts) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Workflow</span>
          <div className="w-56">
            <Select value={b.status} onValueChange={(v) => action("status", `Status set to ${v}`, { status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BOOKING_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isOps && !b.rates_locked && !closed && (
            <Button size="sm" variant="outline" onClick={() => action("lock-rates", "Rates locked")}>
              <Lock size={14} /> Lock Rates
            </Button>
          )}
          {b.rates_locked && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Lock size={13} /> Rates locked</span>
          )}
          {isOps && !closed && (
            <Button size="sm" onClick={() => { if (confirm("Close and mark this booking completed?")) action("close", "Booking completed"); }}>
              <CheckCircle2 size={14} /> Close Booking
            </Button>
          )}
          {isAdmin && closed && (
            <Button size="sm" variant="outline" onClick={() => action("reopen", "Booking reopened")}>
              Reopen
            </Button>
          )}
        </div>
      )}

      <ServiceGroup
        title="Hotels" icon={<Bed size={16} />} stype="hotel"
        items={b.hotels} canEdit={canModify} canSeeCost={canSeeCost} canConfirm={isOps && !locked}
        onAdd={() => setDialog({ stype: "hotel", service: null })}
        onEdit={(s) => setDialog({ stype: "hotel", service: s })}
        onRemove={(sid) => removeService("hotel", sid)}
        onConfirm={(sid) => confirmService("hotel", sid)}
        primary={(s) => `${s.hotel_name || "Hotel"}${s.city ? " · " + s.city : ""}`}
        secondary={(s) => `${(s.checkin as string || "").slice(0, 10)} → ${(s.checkout as string || "").slice(0, 10)}`}
      />
      <ServiceGroup
        title="Flights" icon={<Plane size={16} />} stype="flight"
        items={b.flights} canEdit={canModify} canSeeCost={canSeeCost} canConfirm={isOps && !locked}
        onAdd={() => setDialog({ stype: "flight", service: null })}
        onEdit={(s) => setDialog({ stype: "flight", service: s })}
        onRemove={(sid) => removeService("flight", sid)}
        onConfirm={(sid) => confirmService("flight", sid)}
        primary={(s) => `${s.airline || "Flight"} ${s.flight_number || ""}`}
        secondary={(s) => `${s.origin || ""} → ${s.destination || ""}${s.pnr ? " · PNR " + s.pnr : ""}`}
      />
      <ServiceGroup
        title="Other Services" icon={<Sparkles size={16} />} stype="other"
        items={b.others} canEdit={canModify} canSeeCost={canSeeCost} canConfirm={isOps && !locked}
        onAdd={() => setDialog({ stype: "other", service: null })}
        onEdit={(s) => setDialog({ stype: "other", service: s })}
        onRemove={(sid) => removeService("other", sid)}
        onConfirm={(sid) => confirmService("other", sid)}
        primary={(s) => String(s.service_type || "Service")}
        secondary={(s) => String(s.description || "")}
      />

      {Array.isArray(b.timeline) && b.timeline.length > 0 && (
        <Section title="Timeline">
          <div className="p-5 space-y-3">
            {[...b.timeline].reverse().map((t, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <Clock size={14} className="text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-slate-800">{t.action}</div>
                  <div className="text-xs text-slate-400">
                    {t.by} · {new Date(t.at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog?.service ? "Edit" : "Add"} {dialog?.stype === "other" ? "Service" : dialog?.stype}
            </DialogTitle>
          </DialogHeader>
          {dialog && (
            <ServiceForm
              stype={dialog.stype}
              initial={dialog.service}
              numPax={numPax}
              canSeeCost={canSeeCost}
              saving={saving}
              onCancel={() => setDialog(null)}
              onSubmit={submitService}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Tax Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Discount (₹)</div>
                <input
                  type="number"
                  value={invForm.discount}
                  onChange={(e) => setInvForm((f) => ({ ...f, discount: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">GST Rate (%)</div>
                <input
                  type="number"
                  value={invForm.tax_rate}
                  onChange={(e) => setInvForm((f) => ({ ...f, tax_rate: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">GST Applied On</div>
              <Select value={invForm.gst_basis} onValueChange={(v) => setInvForm((f) => ({ ...f, gst_basis: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Total invoice value</SelectItem>
                  <SelectItem value="service_charge">Service charge only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-slate-500">
              Line items are built automatically from this booking&apos;s services. This locks the booking for editing.
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setInvOpen(false)} disabled={invSaving}>Cancel</Button>
            <Button onClick={generateInvoice} disabled={invSaving}>{invSaving ? "Generating…" : "Generate Invoice"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceGroup({
  title, icon, stype, items, canEdit, canSeeCost, canConfirm, onAdd, onEdit, onRemove, onConfirm, primary, secondary,
}: {
  title: string;
  icon: React.ReactNode;
  stype: SType;
  items: Record<string, unknown>[] | undefined;
  canEdit: boolean;
  canSeeCost: boolean;
  canConfirm: boolean;
  onAdd: () => void;
  onEdit: (s: Record<string, unknown>) => void;
  onRemove: (sid: string) => void;
  onConfirm: (sid: string) => void;
  primary: (s: Record<string, unknown>) => string;
  secondary: (s: Record<string, unknown>) => string;
}) {
  const list = items ?? [];
  return (
    <Section
      title={title}
      actions={canEdit && <Button size="sm" variant="outline" onClick={onAdd}><Plus size={15} /> Add</Button>}
    >
      {list.length === 0 ? (
        <div className="px-5 py-8"><EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`} /></div>
      ) : (
        <div className="divide-y divide-slate-100">
          {list.map((s) => (
            <div key={String(s.sid)} className="px-5 py-3.5 flex items-center gap-4">
              <div className="text-slate-400">{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 flex items-center gap-2">
                  {primary(s)}
                  {s.confirmed ? <CheckCircle2 size={14} className="text-emerald-500" /> : null}
                </div>
                <div className="text-xs text-slate-500 truncate">{secondary(s)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tnum text-slate-900">{money(Number(s.customer_selling_amount))}</div>
                {canSeeCost && (
                  <div className="text-[11px] tnum text-emerald-600">
                    +{money(Number(s.profit))} ({Number(s.margin ?? 0)}%)
                  </div>
                )}
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  {canConfirm && !s.confirmed && (
                    <Button size="sm" variant="ghost" onClick={() => onConfirm(String(s.sid))} title="Confirm">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onEdit(s)}><Pencil size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => onRemove(String(s.sid))}><Trash2 size={14} className="text-red-500" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{label}</div>
      <div className={`text-2xl font-bold tnum font-heading mt-1 ${tone === "emerald" ? "text-emerald-600" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}