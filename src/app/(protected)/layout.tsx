import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import { Toaster } from "@/components/ui/sonner";
import { NavLink } from "@/components/ui/nav-link";

// Every protected page reads the session at request time.
export const dynamic = "force-dynamic";

type NavItem = { href: string; label: string; adminOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bookings", label: "Bookings" },
  { href: "/customers", label: "Customers" },
  { href: "/hotels", label: "Hotels" },
  { href: "/flights", label: "Flights" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/invoices", label: "Invoices" },
  { href: "/payments", label: "Payments" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/reports", label: "Reports" },
  { href: "/users", label: "Users", adminOnly: true },
  { href: "/settings", label: "Settings" },
];

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Profile carries tenant + role. RLS returns only the caller's own profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role, tenant_id, tenants(name)")
    .eq("id", user.id)
    .single();

  const tenantName =
    (profile?.tenants as unknown as { name: string } | null)?.name ?? "Workspace";

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-indigo-600" />
            <div>
              <div className="font-heading font-bold leading-none">{tenantName}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Booking ERP</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-300">
              {profile?.name} · <span className="capitalize">{profile?.role}</span>
            </span>
            <LogoutButton />
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-slate-800 px-6">
          {items.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="animate-in-up mx-auto max-w-7xl p-6">{children}</main>
      <Toaster />
    </div>
  );
}
