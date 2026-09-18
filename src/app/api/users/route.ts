import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole, errorResponse, getSessionProfile, HttpError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const Body = z.object({
  id: z.string().uuid(),
  role: z.enum(["super_admin", "admin", "sales", "operations", "accounts"]).optional(),
  active: z.boolean().optional(),
  name: z.string().min(1).max(80).optional(),
});

const CreateBody = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  role: z.enum(["super_admin", "admin", "sales", "operations", "accounts"]),
});

/** Create a new login (auth user + profile) inside the current admin's tenant. */
export async function POST(req: Request) {
  try {
    const { profile } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");
    assertRole(profile.role, []); // admin / super_admin only

    const { name, email, password, role } = CreateBody.parse(await req.json());

    if (role === "super_admin" && profile.role !== "super_admin") {
      throw new HttpError(403, "Only a super admin can grant the super admin role");
    }

    const admin = createAdminClient();

    // 1) Create the auth user, pre-confirmed so they can log in right away.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createErr || !created?.user) {
      throw new HttpError(400, createErr?.message ?? "Could not create the user");
    }

    // 2) Link a profile to the current admin's tenant.
    const { data: newProfile, error: profErr } = await admin
      .from("profiles")
      .insert({
        id: created.user.id,
        tenant_id: profile.tenant_id,
        email,
        name,
        role,
        active: true,
      })
      .select("id, email, name, role, active")
      .single();

    if (profErr) {
      // Roll back the auth user so we never leave an orphan login behind.
      await admin.auth.admin.deleteUser(created.user.id);
      throw new HttpError(500, profErr.message);
    }

    return NextResponse.json({ user: newProfile });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Role change / activate-deactivate for an existing user. */
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
