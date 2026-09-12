import "server-only";
import { createClient } from "@supabase/supabase-js";

// Admin client — uses the SERVICE ROLE key and BYPASSES RLS.
// Server-only. Use strictly for privileged operations:
// tenant onboarding, cross-tenant/platform tasks, seeding.
// Never import this into a client component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
