"use client";

import { useEffect } from "react";
import { Printer, X } from "lucide-react";

export function PrintShell({
  title,
  autoPrint = false,
  children,
}: {
  title: string;
  autoPrint?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`
        @media print {
          /* Only the document prints — the app shell stays on screen. */
          header, nav, .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 14mm; size: A4; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center gap-2 px-4">
        <h1 className="text-lg font-semibold text-slate-700">{title}</h1>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <X className="h-4 w-4" /> Close
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[820px] bg-white p-8 shadow print:max-w-none print:p-0 print:shadow-none">
        {children}
      </div>
    </div>
  );
}
