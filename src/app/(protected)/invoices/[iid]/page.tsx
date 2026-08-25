import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { InvoiceDetailView } from "@/components/invoices/invoice-detail-view";
import type { Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: { iid: string } }) {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  const { data } = await supabase.from("invoices").select("*").eq("id", params.iid).single();
  if (!data) notFound();

  return <InvoiceDetailView invoice={data as Invoice} role={profile.role} />;
}
