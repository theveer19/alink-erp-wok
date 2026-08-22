import React from "react";
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const NAVY = "#0F172A";
const SLATE = "#64748B";
const BORDER = "#E2E8F0";
const LIGHT = "#F1F5F9";
const INDIGO = "#4F46E5";
const RED = "#EF4444";

const s = StyleSheet.create({
  page: { padding: 34, fontSize: 9, color: NAVY, fontFamily: "Helvetica" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  row: { flexDirection: "row" },
  company: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY },
  small: { fontSize: 8, color: SLATE, lineHeight: 1.4 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: INDIGO, textAlign: "right" },
  rline: { fontSize: 9, textAlign: "right", marginTop: 2 },
  hr: { borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 10 },
  section: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 8, marginBottom: 4 },
  th: { backgroundColor: NAVY, color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 8, padding: 5 },
  td: { padding: 5, fontSize: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tr: { flexDirection: "row" },
  totRow: { flexDirection: "row", justifyContent: "flex-end" },
  totLabel: { width: 130, textAlign: "right", paddingRight: 8, fontSize: 9, color: SLATE, paddingVertical: 2 },
  totVal: { width: 90, textAlign: "right", fontSize: 9, paddingVertical: 2 },
});

const money = (n: unknown) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const g = (v: unknown) => (v == null ? "" : String(v));

interface Company { name?: string; address?: string; phone?: string; email?: string; website?: string; gst_number?: string; bank_details?: string; terms?: string }
interface Item { description: string; qty: number; rate: number; amount: number }
interface Invoice {
  invoice_number: string; booking_number?: string | null; invoice_date?: string;
  customer?: Record<string, unknown> | null; items?: Item[];
  subtotal: number; discount: number; tax_rate: number; gst_basis: string;
  service_charge_total: number; tax_amount: number; grand_total: number;
  amount_received: number; balance_due: number; terms?: string | null;
}

function Tot({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <View style={s.totRow}>
      <Text style={[s.totLabel, bold ? { fontFamily: "Helvetica-Bold", color: NAVY } : {}]}>{label}</Text>
      <Text style={[s.totVal, bold ? { fontFamily: "Helvetica-Bold" } : {}, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function InvoiceDoc({ invoice, company }: { invoice: Invoice; company: Company }) {
  const c = invoice.customer ?? {};
  const items = invoice.items ?? [];
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.between}>
          <View style={{ width: 300 }}>
            <Text style={s.company}>{company.name || "Tax Invoice"}</Text>
            <View style={{ marginTop: 4 }}>
              {company.address ? <Text style={s.small}>{company.address}</Text> : null}
              {company.phone ? <Text style={s.small}>Phone: {company.phone}</Text> : null}
              {company.email ? <Text style={s.small}>Email: {company.email}</Text> : null}
              {company.gst_number ? <Text style={s.small}>GSTIN: {company.gst_number}</Text> : null}
            </View>
          </View>
          <View style={{ width: 200 }}>
            <Text style={s.title}>TAX INVOICE</Text>
            <Text style={s.rline}>Invoice #: {invoice.invoice_number}</Text>
            <Text style={s.rline}>Date: {g(invoice.invoice_date).slice(0, 10)}</Text>
            <Text style={s.rline}>Booking: {g(invoice.booking_number)}</Text>
          </View>
        </View>

        <View style={s.hr} />

        <Text style={s.section}>BILL TO</Text>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>{g(c.name)}</Text>
        {c.company ? <Text style={s.small}>{g(c.company)}</Text> : null}
        {c.address ? <Text style={s.small}>{g(c.address)}</Text> : null}
        {c.mobile || c.email ? <Text style={s.small}>{g(c.mobile)}  {g(c.email)}</Text> : null}
        {c.gst_number ? <Text style={s.small}>GSTIN: {g(c.gst_number)}</Text> : null}

        <View style={{ height: 10 }} />

        <View style={s.tr}>
          <View style={{ width: 300 }}><Text style={s.th}>Description</Text></View>
          <View style={{ width: 50 }}><Text style={[s.th, { textAlign: "right" }]}>Qty</Text></View>
          <View style={{ width: 85 }}><Text style={[s.th, { textAlign: "right" }]}>Rate</Text></View>
          <View style={{ width: 85 }}><Text style={[s.th, { textAlign: "right" }]}>Amount</Text></View>
        </View>
        {items.map((it, i) => (
          <View style={[s.tr, { backgroundColor: i % 2 ? LIGHT : "#fff" }]} key={i}>
            <View style={{ width: 300 }}><Text style={s.td}>{it.description}</Text></View>
            <View style={{ width: 50 }}><Text style={[s.td, { textAlign: "right" }]}>{it.qty}</Text></View>
            <View style={{ width: 85 }}><Text style={[s.td, { textAlign: "right" }]}>{money(it.rate)}</Text></View>
            <View style={{ width: 85 }}><Text style={[s.td, { textAlign: "right" }]}>{money(it.amount)}</Text></View>
          </View>
        ))}

        <View style={{ height: 10 }} />
        <Tot label="Subtotal" value={money(invoice.subtotal)} />
        <Tot label="Incl. Service Charge" value={money(invoice.service_charge_total)} />
        <Tot label="Discount" value={"- " + money(invoice.discount)} />
        <Tot label={`GST (${invoice.tax_rate}% on ${invoice.gst_basis === "service_charge" ? "Service Charge" : "Total"})`} value={money(invoice.tax_amount)} />
        <Tot label="Grand Total" value={money(invoice.grand_total)} bold />
        <Tot label="Amount Received" value={money(invoice.amount_received)} />
        <Tot label="Balance Due" value={money(invoice.balance_due)} color={RED} bold />

        <View style={{ height: 16 }} />
        {company.bank_details ? (
          <>
            <Text style={s.section}>Bank Details</Text>
            <Text style={s.small}>{company.bank_details}</Text>
          </>
        ) : null}
        {(invoice.terms || company.terms) ? (
          <>
            <Text style={s.section}>Terms & Conditions</Text>
            <Text style={s.small}>{invoice.terms || company.terms}</Text>
          </>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoice: Invoice, company: Company): Promise<Buffer> {
  return renderToBuffer(<InvoiceDoc invoice={invoice} company={company} />);
}
