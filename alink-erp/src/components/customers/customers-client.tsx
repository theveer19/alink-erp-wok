"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader, Section, EmptyState, Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Users, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import type { Customer, Role } from "@/lib/types";

type FormState = {
  name: string;
  company: string;
  contact_person: string;
  mobile: string;
  email: string;
  address: string;
  gst_number: string;
  hotel_service_charge: string;
  flight_service_charge: string;
};

const EMPTY: FormState = {
  name: "",
  company: "",
  contact_person: "",
  mobile: "",
  email: "",
  address: "",
  gst_number: "",
  hotel_service_charge: "",
  flight_service_charge: "",
};

function toForm(c: Customer): FormState {
  return {
    name: c.name ?? "",
    company: c.company ?? "",
    contact_person: c.contact_person ?? "",
    mobile: c.mobile ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
    gst_number: c.gst_number ?? "",
    hotel_service_charge: c.hotel_service_charge?.toString() ?? "",
    flight_service_charge: c.flight_service_charge?.toString() ?? "",
  };
}

export default function CustomersClient({
  role,
  initial,
}: {
  role: Role;
  initial: Customer[];
}) {
  const canEdit = ["admin", "super_admin", "sales", "operations"].includes(role);
  const canDelete = role === "admin" || role === "super_admin";

  const [rows, setRows] = useState<Customer[]>(initial);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const firstLoad = useRef(true);

  // Debounced server-side search (skips the very first render — we already have SSR data).
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error((await res.json()).error);
        setRows(await res.json());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load customers");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const refresh = async () => {
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
    if (res.ok) setRows(await res.json());
  };

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const openNew = () => {
    setForm(EMPTY);
    setEditId(null);
    setOpen(true);
  };
  const openEdit = (c: Customer) => {
    setForm(toForm(c));
    setEditId(c.id);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    setSaving(true);
    try {
      const url = editId ? `/api/customers/${editId}` : "/api/customers";
      const res = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(editId ? "Customer updated" : "Customer added");
      setOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Master list of travellers and companies."
        actions={
          canEdit && (
            <Button onClick={openNew}>
              <Plus size={16} /> New Customer
            </Button>
          )
        }
      />

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customers…"
          className="pl-9"
        />
      </div>

      <Section>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-5 py-2.5 font-medium">Name</th>
                <th className="px-5 py-2.5 font-medium">Company</th>
                <th className="px-5 py-2.5 font-medium">Mobile</th>
                <th className="px-5 py-2.5 font-medium">Email</th>
                <th className="px-5 py-2.5 font-medium">GST</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-5 py-3 text-slate-500">{c.company || "—"}</td>
                  <td className="px-5 py-3">{c.mobile || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{c.email || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{c.gst_number || "—"}</td>
                  <td className="px-5 py-3 text-right">
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                        <Pencil size={15} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={<Users size={40} />}
                      title="No customers yet"
                      subtitle="Add your first customer to get started."
                    />
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit" : "New"} Customer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer Name">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Company Name">
              <Input value={form.company} onChange={(e) => set("company", e.target.value)} />
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
            <Field label="Hotel Service Charge (₹/pax)">
              <Input
                type="number"
                value={form.hotel_service_charge}
                onChange={(e) => set("hotel_service_charge", e.target.value)}
              />
            </Field>
            <Field label="Flight Service Charge (₹/pax)">
              <Input
                type="number"
                value={form.flight_service_charge}
                onChange={(e) => set("flight_service_charge", e.target.value)}
              />
            </Field>
            <Field label="Address" className="col-span-2">
              <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
