import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import SuppliersClient from "@/components/suppliers/suppliers-client";
import type { SupplierFull } from "@/lib/types";

export default async function SuppliersPage() {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  const { data } = await supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  return <SuppliersClient role={profile.role} initial={(data as SupplierFull[]) ?? []} />;
}
