import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createClient();

  // Skeleton check: these read through RLS (only this tenant's rows).
  const [{ count: bookings }, { count: customers }, { count: suppliers }] = await Promise.all([
    supabase.from("bookings").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("suppliers").select("*", { count: "exact", head: true }),
  ]);

  const cards = [
    ["Total Bookings", bookings ?? 0],
    ["Customers", customers ?? 0],
    ["Suppliers", suppliers ?? 0],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Foundation is live. Modules land in the next phases.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{label}</div>
            <div className="text-2xl font-bold text-slate-900 tnum font-heading mt-1">{value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        Phase A skeleton — auth, multi-tenant RLS and app shell working.
        Bookings, invoices, payments and reports arrive in Phase C.
      </div>
    </div>
  );
}
