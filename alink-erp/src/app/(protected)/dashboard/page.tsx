import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { computeFinancials } from "@/lib/bookings";
import { dayOffset, getServiceFeed } from "@/lib/service-feed";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

const num = (v: unknown) => Number(v || 0);

export default async function DashboardPage() {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  const [{ data: bookings }, { data: invoices }, { count: customers }, { count: suppliers }] =
    await Promise.all([
      supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("invoices").select("grand_total, amount_received, balance_due, status").limit(1000),
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase.from("suppliers").select("id", { count: "exact", head: true }),
    ]);

  const list = (bookings ?? []) as Booking[];
  const today = dayOffset(0);

  const feed = await getServiceFeed(supabase, { from: today, to: dayOffset(7) });
  const todays = feed.filter((r) => r.date === today);

  const open = list.filter((b) => !["Closed", "Cancelled"].includes(b.status));
  const totals = list.reduce(
    (acc, b) => {
      const f = computeFinancials(b as never);
      acc.sales += num(f.total_sales);
      acc.cost += num(f.total_supplier_cost);
      acc.profit += num(f.gross_profit);
      return acc;
    },
    { sales: 0, cost: 0, profit: 0 },
  );

  const receivable = (invoices ?? []).reduce((a, i) => a + num(i.balance_due), 0);

  const statusCounts: Record<string, number> = {};
  for (const b of list) statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1;

  const recent = list.slice(0, 8).map((b) => ({
    id: b.id,
    number: b.booking_number,
    customer: b.customer_snapshot?.name ?? "—",
    destination: b.destination ?? "—",
    travel: (b.travel_start_date ?? "").slice(0, 10),
    status: b.status,
    total: computeFinancials(b as never).total_sales,
  }));

  return (
    <DashboardView
      role={profile.role}
      userName={profile.name}
      kpis={{
        totalBookings: list.length,
        openBookings: open.length,
        customers: customers ?? 0,
        suppliers: suppliers ?? 0,
        sales: totals.sales,
        cost: totals.cost,
        profit: totals.profit,
        receivable,
        todayCount: todays.length,
        weekCount: feed.length,
        unassigned: feed.filter((r) => !r.supplier && r.status !== "Cancelled").length,
        unconfirmed: feed.filter((r) => r.status === "Pending").length,
      }}
      today={todays}
      week={feed.slice(0, 10)}
      recent={recent}
      statusCounts={statusCounts}
    />
  );
}
