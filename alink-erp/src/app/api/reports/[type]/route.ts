import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, assertRole } from "@/lib/auth";
import { REPORT_DEFS } from "@/lib/reports";
import { getReportRows, isReportType } from "@/lib/reports.server";

type Ctx = { params: { type: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  assertRole(profile.role, ["accounts", "operations"]);
  if (!isReportType(params.type)) return NextResponse.json({ error: "Unknown report" }, { status: 404 });

  const rows = await getReportRows(supabase, params.type);
  return NextResponse.json({ columns: REPORT_DEFS[params.type].columns, rows });
}
