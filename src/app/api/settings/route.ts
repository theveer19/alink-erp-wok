import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole, errorResponse, getSessionProfile, HttpError } from "@/lib/auth";

const Body = z.object({
  company_name: z.string().min(1).max(120).optional(),
  my_name: z.string().min(1).max(80).optional(),
});

export async function PATCH(req: Request) {
  try {
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");

    const { company_name, my_name } = Body.parse(await req.json());

    if (company_name) {
      assertRole(profile.role, []); // only an admin can change the company name
      const { error } = await supabase
        .from("tenants")
        .update({ name: company_name })
        .eq("id", profile.tenant_id);
      if (error) throw new HttpError(500, error.message);
    }

    if (my_name) {
      const { error } = await supabase.from("profiles").update({ name: my_name }).eq("id", profile.id);
      if (error) throw new HttpError(500, error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
