import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Lightweight endpoint that just touches the database.
// Purpose: give Supabase's free tier a real API hit so the project
// doesn't get auto-paused after 7 days of inactivity.
//
// Call it manually any time (e.g. http://localhost:3000/api/cron/keep-alive),
// or point a scheduler at it once this app is deployed (Vercel Cron, for
// example — see vercel.json). If CRON_SECRET is set in the environment,
// callers must send it as "Authorization: Bearer <CRON_SECRET>".

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requiredSecret = process.env.CRON_SECRET;
  if (requiredSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${requiredSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("tenants").select("id").limit(1);
    if (error) throw error;

    return NextResponse.json({ ok: true, pinged_at: new Date().toISOString() });
  } catch (err) {
    console.error("[keep-alive] Supabase ping failed:", err);
    return NextResponse.json({ ok: false, error: "ping failed" }, { status: 500 });
  }
}
