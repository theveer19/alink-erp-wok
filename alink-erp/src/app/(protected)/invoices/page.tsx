import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import InvoicesClient from "@/components/invoices/invoices-client";
import type { Invoice } from "@/lib/types";

export default async function InvoicesPage() {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  const { data } = await supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(2000);
  const canEdit = ["accounts", "admin", "super_admin"].includes(profile.role);
  return <InvoicesClient initial={(data as Invoice[]) ?? []} canEdit={canEdit} />;
}
