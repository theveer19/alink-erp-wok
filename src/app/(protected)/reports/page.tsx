import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import ReportsClient from "@/components/reports/reports-client";

export default async function ReportsPage() {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile) redirect("/login");
  if (!["accounts", "operations", "admin", "super_admin"].includes(profile.role)) redirect("/dashboard");
  return <ReportsClient />;
}
