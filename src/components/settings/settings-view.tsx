"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X } from "lucide-react";
import type { Role, Tenant } from "@/lib/types";

export function SettingsView({
  tenant,
  me,
  counts,
  channels,
}: {
  tenant: Tenant | null;
  me: { id: string; name: string; email: string | null; role: Role };
  counts: { bookings: number; customers: number; suppliers: number; invoices: number };
  channels: { email: boolean; whatsapp: boolean };
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(tenant?.name ?? "");
  const [myName, setMyName] = useState(me.name);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = ["admin", "super_admin"].includes(me.role);

  async function save(body: Record<string, string>) {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save fail");
      setMsg("Saved");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save fail");
    } finally {
      setSaving(false);
    }
  }

  const flag = (on: boolean) =>
    on ? (
      <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
        <Check className="h-4 w-4" /> Configured
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-sm text-slate-400">
        <X className="h-4 w-4" /> Not configured
      </span>
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-800">Settings</h1>
      <p className="mb-5 text-sm text-slate-500">Company, your profile and notification channels.</p>

      {msg && <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      {error && <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="mb-5 rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Company</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[240px]">
            <span className="mb-1 block text-xs font-medium text-slate-500">Company name</span>
            <input
              value={companyName}
              disabled={!isAdmin}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
            />
          </label>
          {isAdmin && (
            <button
              type="button"
              disabled={saving || !companyName.trim()}
              onClick={() => save({ company_name: companyName.trim() })}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-slate-500">Plan</p><p className="font-medium text-slate-800">{tenant?.plan ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">Status</p><p className="font-medium text-slate-800">{tenant?.status ?? "—"}</p></div>
          <div><p className="text-xs text-slate-500">Bookings</p><p className="font-medium text-slate-800">{counts.bookings}</p></div>
          <div><p className="text-xs text-slate-500">Invoices</p><p className="font-medium text-slate-800">{counts.invoices}</p></div>
        </div>
      </section>

      <section className="mb-5 rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">My profile</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[240px]">
            <span className="mb-1 block text-xs font-medium text-slate-500">Name</span>
            <input
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            disabled={saving || !myName.trim()}
            onClick={() => save({ my_name: myName.trim() })}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Email: {me.email ?? "—"} · Role: <span className="font-medium text-slate-700">{me.role}</span>
        </p>
      </section>

      <section className="mb-5 rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Notification channels</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Email (Resend)</span>
            {flag(channels.email)}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">WhatsApp (Cloud API)</span>
            {flag(channels.whatsapp)}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          These come from server environment variables — <code>RESEND_API_KEY</code>,{" "}
          <code>NOTIFY_FROM_EMAIL</code>, <code>WHATSAPP_TOKEN</code>, <code>WHATSAPP_PHONE_ID</code>.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Masters</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/customers" className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Customers ({counts.customers})
          </Link>
          <Link href="/suppliers" className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Suppliers ({counts.suppliers})
          </Link>
          {isAdmin && (
            <Link href="/users" className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Users
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
