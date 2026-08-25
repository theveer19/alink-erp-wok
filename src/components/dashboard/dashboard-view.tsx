"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  IndianRupee,
  TrendingUp,
  Users,
} from "lucide-react";
import { serviceStatusColor } from "@/lib/booking-actions";
import { statusColor } from "@/lib/bookings";
import type { FeedRow } from "@/lib/service-feed";
import type { Role } from "@/lib/types";

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

interface Kpis {
  totalBookings: number;
  openBookings: number;
  customers: number;
  suppliers: number;
  sales: number;
  cost: number;
  profit: number;
  receivable: number;
  todayCount: number;
  weekCount: number;
  unassigned: number;
  unconfirmed: number;
}

interface RecentRow {
  id: string;
  number: string;
  customer: string;
  destination: string;
  travel: string;
  status: string;
  total: number;
}

export function DashboardView({
  role,
  userName,
  kpis,
  today,
  week,
  recent,
  statusCounts,
}: {
  role: Role;
  userName: string;
  kpis: Kpis;
  today: FeedRow[];
  week: FeedRow[];
  recent: RecentRow[];
  statusCounts: Record<string, number>;
}) {
  const showMoney = ["admin", "super_admin", "operations", "accounts"].includes(role);

  const card = (label: string, value: string, sub?: string, Icon?: typeof Users, tone?: "warn") => (
    <div className={`rounded-lg border p-4 ${tone === "warn" ? "border-amber-200 bg-amber-50" : "border-slate-200"}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {Icon && <Icon className={`h-4 w-4 ${tone === "warn" ? "text-amber-500" : "text-slate-300"}`} />}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Welcome, {userName}</h1>
          <p className="text-sm text-slate-500">
            {kpis.todayCount} service(s) today, {kpis.weekCount} in the next 7 days.
          </p>
        </div>
        <Link
          href="/bookings/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New booking
        </Link>
      </div>

      {/* ---------- KPI cards ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {card("Open bookings", String(kpis.openBookings), `${kpis.totalBookings} total`, CalendarDays)}
        {showMoney && card("Total sales", inr(kpis.sales), `Cost ${inr(kpis.cost)}`, IndianRupee)}
        {showMoney && card("Gross profit", inr(kpis.profit), kpis.sales ? `${((kpis.profit / kpis.sales) * 100).toFixed(1)}% margin` : "—", TrendingUp)}
        {showMoney && card("Receivable", inr(kpis.receivable), "Outstanding on invoices", IndianRupee)}
        {!showMoney && card("Customers", String(kpis.customers), undefined, Users)}
        {!showMoney && card("Suppliers", String(kpis.suppliers), undefined, Users)}
      </div>

      {/* ---------- Action queues ---------- */}
      {(kpis.unassigned > 0 || kpis.unconfirmed > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kpis.unassigned > 0 &&
            card(
              "Supplier pending",
              String(kpis.unassigned),
              "No supplier assigned in the next 7 days",
              AlertTriangle,
              "warn",
            )}
          {kpis.unconfirmed > 0 &&
            card(
              "Confirmation pending",
              String(kpis.unconfirmed),
              "Not yet confirmed by the supplier",
              AlertTriangle,
              "warn",
            )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ---------- Today + week ---------- */}
        <section className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              {today.length > 0 ? "Today's movements" : "Next 7 days"}
            </h2>
            <Link href="/upcoming" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Service</th>
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  <th className="px-3 py-2 font-semibold">City</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {(today.length > 0 ? today : week).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      No travel in the next 7 days.
                    </td>
                  </tr>
                )}
                {(today.length > 0 ? today : week).map((r) => (
                  <tr key={`${r.bookingId}-${r.rowId}`} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2">{r.date ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Link href={`/bookings/${r.bookingId}`} className="font-medium text-slate-800 hover:text-blue-600">
                        {r.title}
                      </Link>
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                        {r.kind}
                      </span>
                    </td>
                    <td className="px-3 py-2">{r.customer || "Walk-in"}</td>
                    <td className="px-3 py-2">{r.city || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${serviceStatusColor(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- Status breakdown ---------- */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Booking pipeline</h2>
          <div className="rounded-lg border border-slate-200 p-3">
            {Object.entries(statusCounts).length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No bookings yet.</p>
            )}
            {Object.entries(statusCounts)
              .sort((a, z) => z[1] - a[1])
              .map(([s, n]) => (
                <div key={s} className="flex items-center justify-between py-1.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(s)}`}>{s}</span>
                  <span className="text-sm font-semibold text-slate-700">{n}</span>
                </div>
              ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {card("Customers", String(kpis.customers))}
            {card("Suppliers", String(kpis.suppliers))}
          </div>
        </section>
      </div>

      {/* ---------- Recent bookings ---------- */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Recent bookings</h2>
          <Link href="/bookings" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            All bookings <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2 font-semibold">Booking</th>
                <th className="px-3 py-2 font-semibold">Customer</th>
                <th className="px-3 py-2 font-semibold">Destination</th>
                <th className="px-3 py-2 font-semibold">Travel</th>
                {showMoney && <th className="px-3 py-2 text-right font-semibold">Total</th>}
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={showMoney ? 6 : 5} className="py-10 text-center text-slate-500">
                    No bookings yet.
                  </td>
                </tr>
              )}
              {recent.map((b) => (
                <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={`/bookings/${b.id}`} className="text-blue-600 hover:underline">
                      {b.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{b.customer}</td>
                  <td className="px-3 py-2">{b.destination}</td>
                  <td className="px-3 py-2">{b.travel || "—"}</td>
                  {showMoney && <td className="px-3 py-2 text-right font-medium">{inr(b.total)}</td>}
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(b.status)}`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
