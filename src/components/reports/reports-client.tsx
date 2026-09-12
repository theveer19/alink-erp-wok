"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Section, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { REPORT_DEFS, type ReportType, type Column } from "@/lib/reports";
import { money } from "@/lib/utils";
import { FileSpreadsheet, FileText, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const TABS = Object.keys(REPORT_DEFS) as ReportType[];

export default function ReportsClient() {
  const [tab, setTab] = useState<ReportType>("booking-profit");
  const [columns, setColumns] = useState<Column[]>(REPORT_DEFS["booking-profit"].columns);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (type: ReportType) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${type}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setColumns(data.columns);
      setRows(data.rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const fmt = (c: Column, v: unknown) => (c.money ? money(Number(v)) : v == null ? "—" : String(v));

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Profit, sales, supplier and accounting insights." />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
            {REPORT_DEFS[t].label}
          </Button>
        ))}
      </div>

      <Section
        title={`${REPORT_DEFS[tab].label} Report`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.open(`/api/reports/${tab}/export?format=csv`, "_blank")}>
              <FileText size={15} /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(`/api/reports/${tab}/export?format=excel`, "_blank")}>
              <FileSpreadsheet size={15} /> Excel
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                {columns.map((c) => (
                  <th key={c.key} className={`px-5 py-2.5 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-5 py-3 ${c.align === "right" ? "text-right tnum" : ""} ${
                        c.key === "gross_profit" || c.key === "profit" ? "text-emerald-600 font-medium" : ""
                      } ${c.key === "outstanding" ? "text-red-600" : ""}`}
                    >
                      {fmt(c, r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={columns.length}><EmptyState icon={<BarChart3 size={40} />} title="No data for this report yet" /></td></tr>
              )}
              {loading && (
                <tr><td colSpan={columns.length} className="px-5 py-8 text-center text-slate-400">Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
