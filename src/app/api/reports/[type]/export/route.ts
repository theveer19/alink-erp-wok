import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSessionProfile, assertRole } from "@/lib/auth";
import { REPORT_DEFS } from "@/lib/reports";
import { getReportRows, isReportType } from "@/lib/reports.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { type: string } };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  assertRole(profile.role, ["accounts", "operations"]);
  if (!isReportType(params.type)) return NextResponse.json({ error: "Unknown report" }, { status: 404 });

  const format = req.nextUrl.searchParams.get("format") || "csv";
  const cols = REPORT_DEFS[params.type].columns;
  const rows = await getReportRows(supabase, params.type);

  // shape rows using column labels as headers
  const shaped = rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const c of cols) o[c.label] = r[c.key];
    return o;
  });
  const headers = cols.map((c) => c.label);
  const data = shaped.length ? shaped : [Object.fromEntries(headers.map((h) => [h, ""]))];

  if (format === "excel") {
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${params.type}.xlsx"`,
      },
    });
  }

  // CSV
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...data.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${params.type}.csv"`,
    },
  });
}
