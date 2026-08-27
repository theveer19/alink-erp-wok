"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top-nav link that highlights itself when its route is active.
 * "/bookings" stays active on "/bookings/123" too, but "/" only matches exactly.
 */
export function NavLink({
  href,
  children,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const active = exact || href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "relative px-3 py-3.5 text-sm transition-colors",
        active
          ? "font-semibold text-white after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-blue-400 after:content-['']"
          : "text-slate-300 hover:text-white",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
