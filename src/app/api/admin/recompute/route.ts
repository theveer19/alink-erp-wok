import { NextResponse } from "next/server";
import { assertRole, errorResponse, getSessionProfile, HttpError } from "@/lib/auth";
import { numPaxOf, recomputeService } from "@/lib/bookings";
import { applySupplierCharges, rebuildAdjustments } from "@/lib/booking-charges";
import type { Booking } from "@/lib/types";

type Svc = Record<string, unknown>;

/**
 * Service amounts are stored, not derived, so a pricing fix only reaches old
 * bookings when they are saved again. This walks every booking and does that.
 */
export async function POST() {
  try {
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");
    assertRole(profile.role, []); // admin / super_admin only

    const { data, error } = await supabase.from("bookings").select("*").limit(5000);
    if (error) throw new HttpError(500, error.message);

    const bookings = (data ?? []) as Booking[];
    let updated = 0;
    const failures: string[] = [];

    for (const b of bookings) {
      const pax = numPaxOf(b as never);
      const patch: Record<string, unknown> = {};

      for (const key of ["hotels", "flights", "others"] as const) {
        const list = ((b[key] as Svc[]) ?? []).map((s) =>
          recomputeService(applySupplierCharges(s), pax),
        );
        patch[key] = list;
      }

      patch.adjustments = rebuildAdjustments({ ...b, ...patch } as never);

      const { error: upErr } = await supabase.from("bookings").update(patch).eq("id", b.id);
      if (upErr) failures.push(`${b.booking_number}: ${upErr.message}`);
      else updated += 1;
    }

    return NextResponse.json({ total: bookings.length, updated, failures });
  } catch (e) {
    return errorResponse(e);
  }
}
