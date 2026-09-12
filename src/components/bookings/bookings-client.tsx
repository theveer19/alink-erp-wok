"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Section, EmptyState } from "@/components/common";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/utils";
import { BookingRowActions } from "@/components/bookings/booking-row-actions";
import type { Booking, Role } from "@/lib/types";

/** Status groups behind the tabs, so operations can work one queue at a time. */
const TABS: { key: string; label: string; statuses: string[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "enquiry", label: "Enquiry", statuses: ["Enquiry", "Quotation"] },
  {
    key: "booked",
    label: "Booked",
    statuses: ["Booking Requested", "Customer Confirmed", "Pending Operations"],
  },
  {
    key: "ongoing",
    label: "On-Going",
    statuses: ["Supplier Pending", "Supplier Confirmed", "Partially Confirmed"],
  },
  { key: "completed", label: "Completed", statuses: ["Completed", "Closed"] },
  {
    key: "billed",
    label: "Billed",
    statuses: ["Invoice Generated", "Payment Pending", "Payment Received"],
  },
  { key: "cancelled", label: "Cancelled", statuses: ["Cancelled"] },
];

export default function BookingsClient({
  role,
  canCreate,
  initial,
}: {
  role: Role;
  canCreate: boolean;
  initial: Booking[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Booking[]>(initial);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [service, setService] = useState<"all" | "hotel" | "flight">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const firstLoad = useRef(true);

  const load = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo) p.set("date_to", dateTo);
      const res = await fetch(`/api/bookings?${p.toString()}`);
      if (!res.ok) throw new Error((await res.json()).error);
      setRows(await res.json());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, dateFrom, dateTo]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) {
      c[t.key] = t.statuses ? rows.filter((b) => t.statuses!.includes(b.status)).length : rows.length;
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const def = TABS.find((t) => t.key === tab);
    let list = def?.statuses ? rows.filter((b) => def.statuses!.includes(b.status)) : rows;
    if (service === "hotel") list = list.filter((b) => (b.hotels?.length ?? 0) > 0);
    if (service === "flight") list = list.filter((b) => (b.flights?.length ?? 0) > 0);
    return list;
  }, [rows, tab, service]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        subtitle="All bookings across the lifecycle."
        actions={
          canCreate && (
            <Button onClick={() => router.push("/bookings/new")}>
              <Plus size={16} /> New Booking
            </Button>
          )
        }
      />

      {/* ---------- status tabs ---------- */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative whitespace-nowrap px-4 py-2.5 text-sm transition-colors ${
                active
                  ? "font-semibold text-slate-900 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-slate-900 after:content-['']"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${active ? "text-slate-500" : "text-slate-400"}`}>
                {counts[t.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by ID, destination, sales exec…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-200 p-1">
          {(["all", "hotel", "flight"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setService(v)}
              className={`rounded px-3 py-1.5 text-sm capitalize transition-colors ${
                service === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {v === "all" ? "All services" : v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          <span className="text-sm text-slate-400">→</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Section>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-5 py-2.5 font-medium">Booking ID</th>
                <th className="px-5 py-2.5 font-medium">Customer</th>
                <th className="px-5 py-2.5 font-medium">Destination</th>
                <th className="px-5 py-2.5 font-medium">Travel</th>
                <th className="px-5 py-2.5 font-medium">Sales Exec</th>
                <th className="px-5 py-2.5 text-right font-medium">Sales Value</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="w-12 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((b) => (
                <tr
                  key={b.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => router.push(`/bookings/${b.id}`)}
                >
                  <td className="px-5 py-3 font-medium text-slate-900">{b.booking_number}</td>
                  <td className="px-5 py-3">
                    {b.customer_snapshot?.company || b.customer_snapshot?.name || "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{b.destination || "—"}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {(b.travel_start_date || "").slice(0, 10) || "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{b.sales_executive_name || "—"}</td>
                  <td className="tnum px-5 py-3 text-right font-medium">{money(b.financials?.total_sales)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  {/* The gear must not trigger the row's navigation. */}
                  <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <BookingRowActions
                      booking={{
                        id: b.id,
                        booking_number: b.booking_number,
                        status: b.status,
                        invoice_id: b.invoice_id,
                        rates_locked: b.rates_locked,
                      }}
                      role={role}
                      onChanged={load}
                    />
                  </td>
                </tr>
              ))}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={<Briefcase size={40} />}
                      title="No bookings found"
                      subtitle={
                        tab === "all"
                          ? "Create a new booking to get started."
                          : "Nothing in this queue right now."
                      }
                    />
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
