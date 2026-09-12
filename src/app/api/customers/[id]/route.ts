import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, assertRole, errorResponse } from "@/lib/auth";
import { customerUpdateSchema } from "@/lib/validators";

type Ctx = { params: { id: string } };

// PUT /api/customers/:id  -> update (sales / operations / admin)
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    assertRole(profile.role, ["sales", "operations"]);

    const input = customerUpdateSchema.parse(await req.json());

    const { data, error } = await supabase
      .from("customers")
      .update(input)
      .eq("id", params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}

// DELETE /api/customers/:id  -> admin only
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { user, profile, supabase } = await getSessionProfile();
    if (!user || !profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    assertRole(profile.role, []); // only admin / super_admin

    const { error } = await supabase.from("customers").delete().eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    return errorResponse(e);
  }
}
