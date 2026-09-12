import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { getServiceFeed } from "@/lib/service-feed";
import { ServiceFeedTable } from "@/components/services/service-feed-table";

export const dynamic = "force-dynamic";

export default async function FlightsPage() {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  const rows = await getServiceFeed(supabase, { kind: "flight" });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-800">Flights</h1>
      <p className="mb-5 text-sm text-slate-500">
        Flight segments across every booking — PNR, sector, status and amount.
      </p>
      <ServiceFeedTable rows={rows} role={profile.role} emptyText="No flight services yet." />
    </div>
  );
}
