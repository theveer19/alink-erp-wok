import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import { Toaster } from "@/components/ui/sonner";

// Every protected page reads the session at request time.
export const dynamic = "force-dynamic";

const NAV = [
  ["/dashboard", "Dashboard"],
  ["/bookings", "Bookings"],
  ["/customers", "Customers"],
  ["/hotels", "Hotels"],
  ["/flights", "Flights"],
  ["/suppliers", "Suppliers"],
  ["/invoices", "Invoices"],
  ["/payments", "Payments"],
  ["/upcoming", "Upcoming"],
  ["/reports", "Reports"],
  ["/users", "Users"],
  ["/settings", "Settings"],
];

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Profile carries tenant + role. RLS returns only the caller's own profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role, tenant_id, tenants(name)")
    .eq("id", user.id)
    .single();

  const tenantName =
    (profile?.tenants as unknown as { name: string } | null)?.name ?? "Workspace";

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-indigo-600" />
            <div>
              <div className="font-heading font-bold leading-none">{tenantName}</div>
              <div className="text-[10px] tracking-wider text-slate-400 uppercase">Booking ERP</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-300">
              {profile?.name} · <span className="capitalize">{profile?.role}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
        <nav className="px-6 flex gap-1 overflow-x-auto border-t border-slate-800">
          {NAV.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-3 text-sm text-slate-300 hover:text-white whitespace-nowrap"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="p-6 max-w-7xl mx-auto animate-in-up">{children}</main>
      <Toaster />
    </div>
  );
}
