import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, assertRole, errorResponse } from "@/lib/auth";
import { invoiceUpdateSchema } from "@/lib/validators";

type Ctx = { params: { iid: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data, error } = await supabase.from("invoices").select("*").eq("id", params.iid).single();
  if (error || !data) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    assertRole(profile.role, ["accounts"]);
    const input = invoiceUpdateSchema.parse(await req.json());
    const { data, error } = await supabase.from("invoices").update(input).eq("id", params.iid).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
