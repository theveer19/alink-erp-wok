import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, assertRole, errorResponse } from "@/lib/auth";
import { supplierCreateSchema } from "@/lib/validators";

// GET /api/suppliers?q=&supplier_type=
export async function GET(req: NextRequest) {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const q = raw.replace(/[,()]/g, " ").trim();
  const type = req.nextUrl.searchParams.get("supplier_type")?.trim();

  let query = supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (q) {
    const like = `%${q}%`;
    query = query.or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},mobile.ilike.${like}`);
  }
  if (type && type !== "all") query = query.eq("supplier_type", type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/suppliers  -> create (sales / operations / admin)
export async function POST(req: NextRequest) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    assertRole(profile.role, ["sales", "operations"]);

    const input = supplierCreateSchema.parse(await req.json());
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ ...input, tenant_id: profile.tenant_id })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
