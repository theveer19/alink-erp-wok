import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole, errorResponse, getSessionProfile, HttpError } from "@/lib/auth";

const Body = z.object({
  id: z.string().uuid(),
  role: z.enum(["super_admin", "admin", "sales", "operations", "accounts"]).optional(),
  active: z.boolean().optional(),
  name: z.string().min(1).max(80).optional(),
});

/** Role change / activate-deactivate. New users are invited from Supabase Auth. */
export async function PATCH(req: Request) {
  try {
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");
    assertRole(profile.role, []); // admin / super_admin only

    const { id, ...patch } = Body.parse(await req.json());
    if (Object.keys(patch).length === 0) throw new HttpError(400, "Nothing to update");

    if (id === profile.id && patch.active === false) {
      throw new HttpError(400, "You cannot deactivate yourself");
    }
    if (id === profile.id && patch.role && patch.role !== profile.role) {
      throw new HttpError(400, "You cannot change your own role");
    }
    if (patch.role === "super_admin" && profile.role !== "super_admin") {
      throw new HttpError(403, "Only a super admin can grant the super admin role");
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .select("id, email, name, role, active")
      .single();
    if (error) throw new HttpError(500, error.message);

    return NextResponse.json({ user: data });
  } catch (e) {
    return errorResponse(e);
  }
}
