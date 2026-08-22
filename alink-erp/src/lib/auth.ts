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
  name: string;
  role: Role;
  active: boolean;
  email: string | null;
}

/** Resolve the logged-in user + their tenant profile (server-side, RLS-scoped). */
export async function getSessionProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null as SessionProfile | null, supabase };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, name, role, active, email")
    .eq("id", user.id)
    .single();

  return { user, profile: (profile as SessionProfile) ?? null, supabase };
}

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
