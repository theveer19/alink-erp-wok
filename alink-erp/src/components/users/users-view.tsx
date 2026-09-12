"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Role } from "@/lib/types";

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "super_admin", label: "Super admin", hint: "Everything, including tenant settings" },
  { value: "admin", label: "Admin", hint: "Everything, and can bypass locks" },
  { value: "operations", label: "Operations", hint: "Supplier, confirm, cost" },
  { value: "accounts", label: "Accounts", hint: "Invoice, payments" },
  { value: "sales", label: "Sales", hint: "Creates bookings; cannot see cost" },
];

export function UsersView({ users, meId }: { users: Profile[]; meId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Update fail");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update fail");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-800">Users</h1>
      <p className="mb-5 text-sm text-slate-500">
        Team roles and access. New users are invited from Supabase → Authentication → Invite user.
      </p>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600">
              <th className="px-3 py-2.5 font-semibold">Name</th>
              <th className="px-3 py-2.5 font-semibold">Email</th>
              <th className="px-3 py-2.5 font-semibold">Role</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-3 py-2.5 font-medium text-slate-800">
                  {u.name}
                  {u.id === meId && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-600">{u.email ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <select
                    value={u.role}
                    disabled={busy === u.id || u.id === meId}
                    onChange={(e) => patch(u.id, { role: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      u.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    disabled={busy === u.id || u.id === meId}
                    onClick={() => patch(u.id, { active: !u.active })}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {u.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">What each role can do</h2>
        <ul className="space-y-1 text-sm text-slate-600">
          {ROLES.map((r) => (
            <li key={r.value}>
              <span className="font-medium text-slate-800">{r.label}</span> — {r.hint}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
