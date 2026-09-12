import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import CustomersClient from "@/components/customers/customers-client";
import type { Customer } from "@/lib/types";

export default async function CustomersPage() {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  const { data } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  return <CustomersClient role={profile.role} initial={(data as Customer[]) ?? []} />;
}
