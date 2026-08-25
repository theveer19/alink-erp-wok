import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReport, REPORT_DEFS, type ReportType } from "@/lib/reports";

export function isReportType(t: string): t is ReportType {
  return t in REPORT_DEFS;
}

export async function getReportRows(supabase: SupabaseClient, type: ReportType) {
  const [{ data: bookings }, { data: invoices }, { data: suppliers }, { data: supplierPayments }] =
    await Promise.all([
      supabase.from("bookings").select("*").limit(5000),
      supabase.from("invoices").select("*").limit(5000),
      supabase.from("suppliers").select("id, name").limit(5000),
      supabase.from("payments").select("supplier_id, amount").eq("type", "supplier").limit(5000),
    ]);

  return buildReport(type, {
    bookings: bookings ?? [],
    invoices: invoices ?? [],
    suppliers: (suppliers as { id: string; name: string }[]) ?? [],
    supplierPayments: supplierPayments ?? [],
  });
}
