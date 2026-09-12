// Report builders — ported 1:1 from the demo /reports logic.
import { computeFinancials } from "@/lib/bookings";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown) => Number(v || 0);

export type ReportType =
  | "booking-profit" | "sales" | "supplier-purchase" | "accounts-receivable" | "accounts-payable";

export interface Column { key: string; label: string; money?: boolean; align?: "right" }

export const REPORT_DEFS: Record<ReportType, { label: string; columns: Column[] }> = {
  "booking-profit": {
    label: "Booking Profit",
    columns: [
      { key: "booking_number", label: "Booking" },
      { key: "customer", label: "Customer" },
      { key: "sales_executive", label: "Sales Exec" },
      { key: "travel_date", label: "Travel" },
      { key: "supplier_cost", label: "Supplier Cost", money: true, align: "right" },
      { key: "sales_value", label: "Sales Value", money: true, align: "right" },
      { key: "gross_profit", label: "Gross Profit", money: true, align: "right" },
      { key: "margin", label: "Margin %", align: "right" },
    ],
  },
  sales: {
    label: "Sales",
    columns: [
      { key: "sales_executive", label: "Sales Exec" },
      { key: "bookings", label: "Bookings", align: "right" },
      { key: "sales_value", label: "Sales Value", money: true, align: "right" },
      { key: "profit", label: "Profit", money: true, align: "right" },
    ],
  },
  "supplier-purchase": {
    label: "Supplier Purchase",
    columns: [
      { key: "supplier", label: "Supplier" },
      { key: "bookings", label: "Bookings", align: "right" },
      { key: "purchase_value", label: "Purchase Value", money: true, align: "right" },
      { key: "pending_payment", label: "Pending Payment", money: true, align: "right" },
    ],
  },
  "accounts-receivable": {
    label: "Receivable",
    columns: [
      { key: "customer", label: "Customer" },
      { key: "invoice_number", label: "Invoice #" },
      { key: "invoice_amount", label: "Invoice Amount", money: true, align: "right" },
      { key: "received", label: "Received", money: true, align: "right" },
      { key: "outstanding", label: "Outstanding", money: true, align: "right" },
      { key: "date", label: "Date" },
    ],
  },
  "accounts-payable": {
    label: "Payable",
    columns: [
      { key: "supplier", label: "Supplier" },
      { key: "supplier_bill", label: "Supplier Bill", money: true, align: "right" },
      { key: "paid", label: "Paid", money: true, align: "right" },
      { key: "outstanding", label: "Outstanding", money: true, align: "right" },
    ],
  },
};

type Row = Record<string, unknown>;
interface Data {
  bookings: Row[];
  invoices: Row[];
  suppliers: { id: string; name: string }[];
  supplierPayments: Row[];
}

export function buildReport(type: ReportType, data: Data): Row[] {
  const { bookings, invoices, suppliers, supplierPayments } = data;
  const fin = (b: Row) => computeFinancials(b as never);

  const paidBySupplier: Record<string, number> = {};
  const supName = Object.fromEntries(suppliers.map((s) => [s.id, s.name]));
  for (const p of supplierPayments) {
    const nm = supName[String(p.supplier_id)];
    if (nm) paidBySupplier[nm] = (paidBySupplier[nm] || 0) + num(p.amount);
  }

  if (type === "booking-profit") {
    return bookings.map((b) => {
      const f = fin(b);
      return {
        booking_number: b.booking_number,
        customer: (b.customer_snapshot as Row)?.name ?? "",
        sales_executive: b.sales_executive_name ?? "",
        travel_date: String(b.travel_start_date || "").slice(0, 10),
        supplier_cost: f.total_supplier_cost,
        sales_value: f.total_sales,
        gross_profit: f.gross_profit,
        margin: f.margin,
      };
    });
  }

  if (type === "sales") {
    const agg: Record<string, Row> = {};
    for (const b of bookings) {
      const k = (b.sales_executive_name as string) || "Unassigned";
      const f = fin(b);
      const a = (agg[k] ??= { sales_executive: k, bookings: 0, sales_value: 0, profit: 0 });
      a.bookings = (a.bookings as number) + 1;
      a.sales_value = round2((a.sales_value as number) + f.total_sales);
      a.profit = round2((a.profit as number) + (f.gross_profit ?? 0));
    }
    return Object.values(agg);
  }

  if (type === "supplier-purchase") {
    const agg: Record<string, Row> = {};
    for (const b of bookings) {
      const svcs = [...(b.hotels as Row[] ?? []), ...(b.flights as Row[] ?? []), ...(b.others as Row[] ?? [])];
      for (const s of svcs) {
        const name = s.supplier_name as string;
        if (!name) continue;
        const a = (agg[name] ??= { supplier: name, bookings: 0, purchase_value: 0 });
        a.bookings = (a.bookings as number) + 1;
        a.purchase_value = round2((a.purchase_value as number) + num(s.total_supplier_cost));
      }
    }
    for (const [name, a] of Object.entries(agg)) {
      a.pending_payment = round2((a.purchase_value as number) - (paidBySupplier[name] || 0));
    }
    return Object.values(agg);
  }

  if (type === "accounts-receivable") {
    return invoices.map((i) => ({
      customer: (i.customer as Row)?.name ?? "",
      invoice_number: i.invoice_number,
      invoice_amount: num(i.grand_total),
      received: num(i.amount_received),
      outstanding: num(i.balance_due),
      date: String(i.invoice_date || "").slice(0, 10),
    }));
  }

  if (type === "accounts-payable") {
    const bill: Record<string, number> = {};
    for (const b of bookings) {
      const svcs = [...(b.hotels as Row[] ?? []), ...(b.flights as Row[] ?? []), ...(b.others as Row[] ?? [])];
      for (const s of svcs) {
        const name = s.supplier_name as string;
        if (!name) continue;
        bill[name] = round2((bill[name] || 0) + num(s.total_supplier_cost));
      }
    }
    return Object.entries(bill).map(([supplier, b]) => ({
      supplier,
      supplier_bill: b,
      paid: round2(paidBySupplier[supplier] || 0),
      outstanding: round2(b - (paidBySupplier[supplier] || 0)),
    }));
  }

  return [];
}
