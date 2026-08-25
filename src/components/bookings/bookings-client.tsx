"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Section, EmptyState } from "@/components/common";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/utils";
import { BOOKING_STATUSES } from "@/lib/bookings";
import type { Booking, Role } from "@/lib/types";

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
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const firstLoad = useRef(true);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const p = new URLSearchParams();
        if (q) p.set("q", q);
        if (status !== "all") p.set("status", status);
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
    }, 300);
    return () => clearTimeout(t);
  }, [q, status, dateFrom, dateTo]);

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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by ID, destination, sales exec…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {BOOKING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          <span className="text-slate-400 text-sm">→</span>
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
                <th className="px-5 py-2.5 font-medium text-right">Sales Value</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((b) => (
                <tr
                  key={b.id}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => router.push(`/bookings/${b.id}`)}
                >
                  <td className="px-5 py-3 font-medium text-slate-900">{b.booking_number}</td>
                  <td className="px-5 py-3">{b.customer_snapshot?.name || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{b.destination || "—"}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {(b.travel_start_date || "").slice(0, 10) || "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{b.sales_executive_name || "—"}</td>
                  <td className="px-5 py-3 text-right tnum font-medium">{money(b.financials?.total_sales)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={<Briefcase size={40} />}
                      title="No bookings found"
                      subtitle="Create a new booking to get started."
                    />
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
    </div>
  );
}
