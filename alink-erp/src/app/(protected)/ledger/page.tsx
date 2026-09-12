import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { LedgerView, type LedgerRow } from "@/components/ledger/ledger-view";

export const dynamic = "force-dynamic";

const num = (v: unknown) => Number(v || 0);

export default async function LedgerPage() {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");
  if (!["admin", "super_admin", "accounts", "operations"].includes(profile.role)) redirect("/dashboard");

  const [{ data: customers }, { data: invoices }, { data: payments }] = await Promise.all([
    supabase.from("customers").select("id, name, company, mobile, email").limit(2000),
    supabase.from("invoices").select("customer, booking_id, grand_total, amount_received, balance_due, status").limit(5000),
    supabase.from("payments").select("amount, type, booking_id").eq("type", "customer").limit(5000),
  ]);

  // Invoices store a customer snapshot, so match on the billed name.
  const byName: Record<string, LedgerRow> = {};
  for (const c of customers ?? []) {
    const key = (c.company || c.name || "").trim().toLowerCase();
    if (!key) continue;
    byName[key] = {
      id: c.id,
      name: c.company || c.name,
      contact: c.name ?? "",
      mobile: c.mobile ?? "",
      email: c.email ?? "",
      invoiced: 0,
      received: 0,
      outstanding: 0,
      invoices: 0,
    };
  }

  for (const i of invoices ?? []) {
    const cust = (i.customer ?? {}) as { name?: string; company?: string };
    const key = (cust.company || cust.name || "").trim().toLowerCase();
    const row =
      byName[key] ??
      (byName[key] = {
        id: key,
        name: cust.company || cust.name || "Unknown",
        contact: "",
        mobile: "",
        email: "",
        invoiced: 0,
        received: 0,
        outstanding: 0,
        invoices: 0,
      });
    row.invoiced += num(i.grand_total);
    row.received += num(i.amount_received);
    row.outstanding += num(i.balance_due);
    row.invoices += 1;
  }

  const rows = Object.values(byName)
    .filter((r) => r.invoices > 0 || r.outstanding !== 0)
    .sort((a, z) => z.outstanding - a.outstanding);

  const unbilled = (payments ?? []).length;

  return <LedgerView rows={rows} paymentCount={unbilled} />;
}
