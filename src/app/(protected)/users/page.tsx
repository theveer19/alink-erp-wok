import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { UsersView } from "@/components/users/users-view";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");
  if (!["admin", "super_admin"].includes(profile.role)) redirect("/dashboard");

  const { data } = await supabase
    .from("profiles")
    .select("id, tenant_id, email, name, role, active, created_at")
    .order("created_at", { ascending: true });

  return <UsersView users={(data ?? []) as Profile[]} meId={profile.id} />;
}
