"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader, Section, EmptyState, Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Building2, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import type { SupplierFull, Role } from "@/lib/types";

const TYPES = ["Hotel", "Flight", "DMC", "Transport", "Sightseeing", "Other"] as const;

type FormState = {
  name: string;
  company: string;
  supplier_type: string;
  contact_person: string;
  mobile: string;
  email: string;
  address: string;
  gst_number: string;
  payment_terms: string;
  default_rate: string;
  default_service_charge: string;
  bank_details: string;
  remarks: string;
  active: boolean;
};

const EMPTY: FormState = {
  name: "",
  company: "",
  supplier_type: "Hotel",
  contact_person: "",
  mobile: "",
  email: "",
  address: "",
  gst_number: "",
  payment_terms: "",
  default_rate: "",
  default_service_charge: "",
  bank_details: "",
  remarks: "",
  active: true,
};

function toForm(s: SupplierFull): FormState {
  return {
    name: s.name ?? "",
    company: s.company ?? "",
    supplier_type: s.supplier_type ?? "Hotel",
    contact_person: s.contact_person ?? "",
    mobile: s.mobile ?? "",
    email: s.email ?? "",
    address: s.address ?? "",
    gst_number: s.gst_number ?? "",
    payment_terms: s.payment_terms ?? "",
    default_rate: s.default_rate?.toString() ?? "",
    default_service_charge: s.default_service_charge?.toString() ?? "",
    bank_details: s.bank_details ?? "",
    remarks: s.remarks ?? "",
    active: s.active !== false,
  };
}

export default function SuppliersClient({
  role,
  initial,
}: {
  role: Role;
  initial: SupplierFull[];
}) {
  const canEdit = ["admin", "super_admin", "sales", "operations"].includes(role);

  const [rows, setRows] = useState<SupplierFull[]>(initial);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const firstLoad = useRef(true);

  const fetchRows = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (typeFilter !== "all") params.set("supplier_type", typeFilter);
    const res = await fetch(`/api/suppliers?${params.toString()}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return (await res.json()) as SupplierFull[];
  };

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setRows(await fetchRows());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load suppliers");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, typeFilter]);

  const set = (k: keyof FormState, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const openNew = () => {
    setForm(EMPTY);
    setEditId(null);
    setOpen(true);
  };
  const openEdit = (s: SupplierFull) => {
    setForm(toForm(s));
    setEditId(s.id);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    setSaving(true);
    try {
      const url = editId ? `/api/suppliers/${editId}` : "/api/suppliers";
      const res = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(editId ? "Supplier updated" : "Supplier added");
      setOpen(false);
      setRows(await fetchRows());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save supplier");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        subtitle="Master list of hotels, airlines, DMCs and transport vendors."
        actions={
          canEdit && (
            <Button onClick={openNew}>
              <Plus size={16} /> New Supplier
            </Button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search suppliers…"
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Section>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-5 py-2.5 font-medium">Name</th>
                <th className="px-5 py-2.5 font-medium">Type</th>
                <th className="px-5 py-2.5 font-medium">Contact</th>
                <th className="px-5 py-2.5 font-medium">Email</th>
                <th className="px-5 py-2.5 font-medium">Payment Terms</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-5 py-3">
                    <Badge variant="outline">{s.supplier_type}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{s.contact_person || s.mobile || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{s.email || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{s.payment_terms || "—"}</td>
                  <td className="px-5 py-3">
                    {s.active !== false ? (
                      <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                        <Pencil size={15} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={<Building2 size={40} />} title="No suppliers yet" />
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit" : "New"} Supplier</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Supplier Name">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Company Name">
              <Input value={form.company} onChange={(e) => set("company", e.target.value)} />
            </Field>
            <Field label="Supplier Type">
              <Select value={form.supplier_type} onValueChange={(v) => set("supplier_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Contact Person">
              <Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} />
            </Field>
            <Field label="Mobile">
              <Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="GST Number">
              <Input value={form.gst_number} onChange={(e) => set("gst_number", e.target.value)} />
            </Field>
            <Field label="Payment Terms">
              <Input
                value={form.payment_terms}
                onChange={(e) => set("payment_terms", e.target.value)}
                placeholder="e.g. 30 days credit"
              />
            </Field>
            <Field label="Default Rate (₹)">
              <Input
                type="number"
                value={form.default_rate}
                onChange={(e) => set("default_rate", e.target.value)}
              />
            </Field>
            <Field label="Default Service Charge (₹)">
              <Input
                type="number"
                value={form.default_service_charge}
                onChange={(e) => set("default_service_charge", e.target.value)}
              />
            </Field>
            <Field label="Address" className="col-span-2">
              <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="Bank Details" className="col-span-2">
              <Textarea value={form.bank_details} onChange={(e) => set("bank_details", e.target.value)} />
            </Field>
            <div className="col-span-2 flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
              <span className="text-sm">Active</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
