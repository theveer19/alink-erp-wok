import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { SettingsView } from "@/components/settings/settings-view";
import type { Tenant } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", profile.tenant_id)
    .single();

  const [{ count: bookings }, { count: customers }, { count: suppliers }, { count: invoices }] =
    await Promise.all([
      supabase.from("bookings").select("id", { count: "exact", head: true }),
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase.from("suppliers").select("id", { count: "exact", head: true }),
      supabase.from("invoices").select("id", { count: "exact", head: true }),
    ]);

  return (
    <SettingsView
      tenant={(tenant ?? null) as Tenant | null}
      me={{ id: profile.id, name: profile.name, email: profile.email, role: profile.role }}
      counts={{
        bookings: bookings ?? 0,
        customers: customers ?? 0,
        suppliers: suppliers ?? 0,
        invoices: invoices ?? 0,
      }}
      channels={{
        email: !!process.env.RESEND_API_KEY && !!process.env.NOTIFY_FROM_EMAIL,
        whatsapp: !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID,
      }}
    />
  );
}
