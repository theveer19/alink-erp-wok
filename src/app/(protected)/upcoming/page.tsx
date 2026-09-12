import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth";
import { dayOffset, getServiceFeed } from "@/lib/service-feed";
import { ServiceFeedTable } from "@/components/services/service-feed-table";

export const dynamic = "force-dynamic";

const RANGES = [
  { days: 7, label: "Next 7 days" },
  { days: 15, label: "Next 15 days" },
  { days: 30, label: "Next 30 days" },
];

export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) redirect("/login");

  const days = Number(searchParams.days) || 7;
  const rows = await getServiceFeed(supabase, {
    from: dayOffset(0),
    to: dayOffset(days),
    statuses: ["Pending", "Supplier Requested", "Confirmed"],
  });

  const unassigned = rows.filter((r) => !r.supplier).length;
  const pending = rows.filter((r) => r.status !== "Confirmed").length;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-800">Upcoming</h1>
      <p className="mb-4 text-sm text-slate-500">
        Upcoming travel — {pending} service(s) unconfirmed, {unassigned} without a supplier.
      </p>

      <div className="mb-4 flex gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.days}
            href={`/upcoming?days=${r.days}`}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              days === r.days
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 text-slate-600 hover:border-slate-400"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <ServiceFeedTable
        rows={rows}
        role={profile.role}
        showKind
        emptyText="No travel in this period."
      />
    </div>
  );
}
