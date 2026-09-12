import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { renderVoucherPdf } from "@/lib/pdf/voucher";
import { withTimeline } from "@/lib/booking-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", params.id).single();
  if (error || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // company profile (per tenant); fall back to tenant name if none set yet
  const { data: company } = await supabase
    .from("company_settings")
    .select("name, address, phone, email, website, gst_number")
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  let comp = company;
  if (!comp?.name) {
    const { data: tenant } = await supabase.from("tenants").select("name").eq("id", profile.tenant_id).single();
    comp = { ...(comp ?? {}), name: comp?.name || tenant?.name || "Booking Voucher" } as typeof comp;
  }

  const pdf = await renderVoucherPdf(booking, comp ?? {});

  // mark voucher generated once + timeline
  if (!booking.voucher_generated) {
    await supabase
      .from("bookings")
      .update({ voucher_generated: true, timeline: withTimeline(booking.timeline, profile.name, "Booking voucher generated") })
      .eq("id", params.id);
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="voucher-${booking.booking_number}.pdf"`,
    },
  });
}
