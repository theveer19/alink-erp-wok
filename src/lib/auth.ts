import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { Role } from "@/lib/types";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface SessionProfile {
  id: string;
  tenant_id: string;
  tenant_name: string;
  name: string;
  role: Role;
  active: boolean;
  email: string | null;
}

/**
 * Resolve the logged-in user + their tenant profile (server-side, RLS-scoped).
 *
 * Wrapped in React `cache()` so that within a single request the layout, the
 * page and any nested server component share ONE auth + profile lookup instead
 * of each hitting Supabase again. This removes several sequential round trips
 * per navigation.
 */
export const getSessionProfile = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null as SessionProfile | null, supabase };

  const { data } = await supabase
    .from("profiles")
    .select("id, tenant_id, name, role, active, email, tenants(name)")
    .eq("id", user.id)
    .single();

  const profile: SessionProfile | null = data
    ? {
        id: data.id as string,
        tenant_id: data.tenant_id as string,
        tenant_name:
          (data.tenants as unknown as { name: string } | null)?.name ?? "Workspace",
        name: data.name as string,
        role: data.role as Role,
        active: data.active as boolean,
        email: (data.email as string | null) ?? null,
      }
    : null;

  return { user, profile, supabase };
});

/** admin / super_admin always pass; otherwise the role must be allowed. */
export function assertRole(role: Role | undefined, allowed: Role[]) {
  if (role === "admin" || role === "super_admin") return;
  if (!role || !allowed.includes(role)) {
    throw new HttpError(403, "You do not have permission for this action");
  }
}

/** Turn thrown errors into a consistent JSON response. */
export function errorResponse(e: unknown) {
  if (e instanceof ZodError) {
    const msg = e.issues.map((i) => i.message).join(", ");
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  const message = e instanceof Error ? e.message : "Something went wrong";
  return NextResponse.json({ error: message }, { status: 500 });
}
