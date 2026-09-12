import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { renderInvoicePdf } from "@/lib/pdf/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { iid: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", params.iid).single();
  if (error || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const { data: company } = await supabase
    .from("company_settings")
    .select("name, address, phone, email, website, gst_number, bank_details, terms")
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  let comp = company;
  if (!comp?.name) {
    const { data: tenant } = await supabase.from("tenants").select("name").eq("id", profile.tenant_id).single();
    comp = { ...(comp ?? {}), name: comp?.name || tenant?.name || "Tax Invoice" } as typeof comp;
  }

  const pdf = await renderInvoicePdf(invoice, comp ?? {});
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
