import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, assertRole, errorResponse } from "@/lib/auth";
import { customerCreateSchema } from "@/lib/validators";

// GET /api/customers?q=  -> tenant-scoped list (RLS), optional search
export async function GET(req: NextRequest) {
  const { user, profile, supabase } = await getSessionProfile();
  if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  // strip characters that would break PostgREST's or() grammar
  const q = raw.replace(/[,()]/g, " ").trim();

  let query = supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `name.ilike.${like},company.ilike.${like},mobile.ilike.${like},email.ilike.${like}`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/customers  -> create (sales / operations / admin)
export async function POST(req: NextRequest) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    assertRole(profile.role, ["sales", "operations"]);

    const input = customerCreateSchema.parse(await req.json());

    const { data, error } = await supabase
      .from("customers")
      .insert({ ...input, tenant_id: profile.tenant_id, created_by: profile.name })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
