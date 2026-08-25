import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole, errorResponse, getSessionProfile, HttpError } from "@/lib/auth";
import {
  assertNotInvoiceLocked,
  bookingResponse,
  getBookingOr404,
  withTimeline,
} from "@/lib/booking-service.server";
import { numPaxOf, recomputeService } from "@/lib/bookings";
import { applySupplierCharges, rebuildAdjustments } from "@/lib/booking-charges";
import type { ServiceKind } from "@/lib/booking-actions";

const SERVICE_KEYS = { hotel: "hotels", flight: "flights", other: "others" } as const;

const ChargeSchema = z.object({
  id: z.string().max(60),
  label: z.string().min(1).max(80),
  amount: z.coerce.number().finite(),
  bearer: z.enum(["customer", "supplier"]),
  remarks: z.string().max(200).optional(),
});

const Body = z.object({
  action: z.enum([
    "send_confirmation",
    "confirm_all",
    "unconfirm_all",
    "delete_booking",
    "update_booking",
    "reopen_booking",
    "lock_rates",
    "unlock_rates",
    "close_booking",
    "duplicate_booking",
    "add_service",
    "remove_service",
    "confirm_service",
    "unconfirm_service",
    "request_supplier",
    "cancel_service",
    "set_labels",
    "update_service",
    "assign_supplier",
    "set_charges",
  ]),
  rowId: z.string().optional(),
  kind: z.enum(["hotel", "flight", "other"]).optional(),
  labels: z.array(z.string().max(40)).max(20).optional(),
  charges: z.array(ChargeSchema).max(40).optional(),
  fields: z.record(z.unknown()).optional(),
  supplier: z
    .object({
      supplier_id: z.string().nullable().optional(),
      supplier_name: z.string().max(120).nullable().optional(),
      supplier_booking_id: z.string().max(80).nullable().optional(),
      supplier_reference: z.string().max(80).nullable().optional(),
    })
    .optional(),
});

function parseRowId(rowId: string | undefined) {
  if (!rowId) throw new HttpError(400, "rowId is required for this action");
  const [kind, idxRaw] = rowId.split(":");
  if (!(kind in SERVICE_KEYS)) throw new HttpError(400, "Invalid service type");
  const index = Number(idxRaw);
  if (!Number.isInteger(index) || index < 0) throw new HttpError(400, "Invalid service index");
  return { kind: kind as ServiceKind, key: SERVICE_KEYS[kind as ServiceKind], index };
}

type Svc = Record<string, unknown>;

const SUPPLIER_EDIT_FIELDS = new Set([
  "supplier_id",
  "supplier_name",
  "supplier_booking_id",
  "supplier_contact",
  "supplier_reference",
  "supplier_rate",
  "supplier_service_charge",
  "currency",
  "taxes",
  "other_charges",
  "other_charges_manual",
  "total_supplier_cost",
]);

const BOOKING_EDIT_FIELDS = new Set([
  "customer_snapshot",
  "travel_start_date",
  "travel_end_date",
  "destination",
  "num_nights",
  "num_adults",
  "num_children",
  "num_rooms",
  "num_travellers",
  "lead_source",
  "booked_by",
  "booker_mobile",
  "booker_email",
  "passengers",
  "special_requirements",
  "internal_remarks",
  "sales_executive_name",
  "service_charge_total",
]);

/** Keeps the old number's prefix and appends a new suffix. Change here for your own scheme. */
function nextBookingNumber(old: string): string {
  const m = /^([A-Za-z\-\/]*)/.exec(old || "");
  const prefix = m?.[1] || "BK-";
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");

    const { action, rowId, kind, labels, charges, fields, supplier } = Body.parse(await req.json());
    const booking = await getBookingOr404(supabase, id);
    const actor = profile.name || profile.email || "system";
    const pax = numPaxOf(booking as never);

    // ---------------- Booking-level ----------------
    if (action === "delete_booking") {
      assertRole(profile.role, []);
      if (booking.invoice_id) throw new HttpError(423, "An invoice is attached — remove the invoice first");
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw new HttpError(500, error.message);
      return NextResponse.json({ ok: true, redirect: "/bookings" });
    }

    if (action === "reopen_booking") {
      assertRole(profile.role, []); // admin / super_admin only
      if (booking.invoice_id) {
        throw new HttpError(423, "Cancel or delete the invoice before reopening this booking");
      }
      const { error } = await supabase
        .from("bookings")
        .update({
          status: "Pending Operations",
          timeline: withTimeline(booking.timeline, actor, `Booking reopened (tha: ${booking.status})`),
        })
        .eq("id", id);
      if (error) throw new HttpError(500, error.message);
      return NextResponse.json(await bookingResponse(supabase, id, profile.role));
    }

    if (action === "duplicate_booking") {
      assertRole(profile.role, ["sales", "operations"]);
      const copy = {
        tenant_id: profile.tenant_id,
        booking_number: nextBookingNumber(String(booking.booking_number ?? "")),
        customer_id: booking.customer_id,
        customer_snapshot: booking.customer_snapshot,
        travel_start_date: booking.travel_start_date,
        travel_end_date: booking.travel_end_date,
        destination: booking.destination,
        num_nights: booking.num_nights,
        num_adults: booking.num_adults,
        num_children: booking.num_children,
        num_rooms: booking.num_rooms,
        num_travellers: booking.num_travellers,
        lead_source: booking.lead_source,
        booked_by: booking.booked_by,
        booker_mobile: booking.booker_mobile,
        booker_email: booking.booker_email,
        passengers: booking.passengers ?? [],
        adjustments: [],
        sales_executive_id: booking.sales_executive_id,
        sales_executive_name: booking.sales_executive_name,
        special_requirements: booking.special_requirements,
        internal_remarks: booking.internal_remarks,
        status: "Enquiry",
        payment_status: "Unpaid",
        // services are copied but supplier confirmations and statuses are reset
        hotels: ((booking.hotels as Svc[]) ?? []).map((s) => ({ ...s, status: "Pending", confirmation_number: null })),
        flights: ((booking.flights as Svc[]) ?? []).map((s) => ({ ...s, status: "Pending", pnr: null })),
        others: ((booking.others as Svc[]) ?? []).map((s) => ({ ...s, status: "Pending" })),
        service_charge_total: booking.service_charge_total,
        rates_locked: false,
        timeline: [
          { at: new Date().toISOString(), by: actor, action: `Duplicated from ${booking.booking_number}` },
        ],
        attachments: [],
        invoice_id: null,
      };

      const { data, error } = await supabase.from("bookings").insert(copy).select("id").single();
      if (error) throw new HttpError(500, error.message);
      return NextResponse.json({ ok: true, redirect: `/bookings/${data.id}` });
    }

    if (action === "lock_rates" || action === "unlock_rates") {
      assertRole(profile.role, ["operations"]);
      const lock = action === "lock_rates";
      const { error } = await supabase
        .from("bookings")
        .update({
          rates_locked: lock,
          timeline: withTimeline(booking.timeline, actor, lock ? "Rates locked" : "Rates unlocked"),
        })
        .eq("id", id);
      if (error) throw new HttpError(500, error.message);
      return NextResponse.json(await bookingResponse(supabase, id, profile.role));
    }

    if (action === "close_booking") {
      assertRole(profile.role, ["operations", "accounts"]);
      const pending = ["hotels", "flights", "others"]
        .flatMap((k) => (booking[k] as Svc[]) ?? [])
        .filter((s) => s.status !== "Confirmed" && s.status !== "Cancelled");
      if (pending.length > 0) {
        throw new HttpError(409, `${pending.length} service(s) are not confirmed yet — confirm or cancel them first`);
      }
      const { error } = await supabase
        .from("bookings")
        .update({
          status: "Closed",
          rates_locked: true,
          timeline: withTimeline(booking.timeline, actor, "Booking closed"),
        })
        .eq("id", id);
      if (error) throw new HttpError(500, error.message);
      return NextResponse.json(await bookingResponse(supabase, id, profile.role));
    }

    if (action === "send_confirmation") {
      // Actual sending happens in /api/bookings/[id]/notify; this only records it.
      assertRole(profile.role, ["sales", "operations"]);
      const { error } = await supabase
        .from("bookings")
        .update({
          status: booking.status === "Enquiry" ? "Booking Requested" : booking.status,
          timeline: withTimeline(booking.timeline, actor, "Confirmation sent to customer"),
        })
        .eq("id", id);
      if (error) throw new HttpError(500, error.message);
      return NextResponse.json(await bookingResponse(supabase, id, profile.role));
    }

    if (action === "update_booking") {
      assertRole(profile.role, ["sales", "operations"]);
      await assertNotInvoiceLocked(supabase, id, profile.role);

      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields ?? {})) if (BOOKING_EDIT_FIELDS.has(k)) patch[k] = v;
      if (Object.keys(patch).length === 0) throw new HttpError(400, "Nothing to update");

      patch.timeline = withTimeline(booking.timeline, actor, "Booking details updated");
      const { error } = await supabase.from("bookings").update(patch).eq("id", id);
      if (error) throw new HttpError(500, error.message);
      return NextResponse.json(await bookingResponse(supabase, id, profile.role));
    }

    if (action === "add_service") {
      assertRole(profile.role, ["sales", "operations"]);
      await assertNotInvoiceLocked(supabase, id, profile.role);
      if (!kind) throw new HttpError(400, "kind is required (hotel/flight/other)");

      const key = SERVICE_KEYS[kind];
      const blank: Svc = {
        status: "Pending",
        labels: [],
        charges: [],
        rate_basis: "flat",
        ...(kind === "hotel"
          ? {
              hotel_name: "",
              city: booking.destination ?? "",
              check_in: booking.travel_start_date ?? null,
              check_out: booking.travel_end_date ?? null,
              nights: booking.num_nights ?? 1,
              rooms: booking.num_rooms ?? 1,
            }
          : kind === "flight"
            ? {
                airline: "",
                flight_number: "",
                from: "",
                to: booking.destination ?? "",
                departure_date: booking.travel_start_date ?? null,
                class: "Economy",
              }
            : { service_name: "", service_date: booking.travel_start_date ?? null }),
      };

      const list = [...((booking[key] as Svc[]) ?? []), recomputeService(blank, pax)];
      const { error } = await supabase
        .from("bookings")
        .update({ [key]: list, timeline: withTimeline(booking.timeline, actor, `${kind} added`) })
        .eq("id", id);
      if (error) throw new HttpError(500, error.message);
      return NextResponse.json(await bookingResponse(supabase, id, profile.role));
    }

    if (action === "confirm_all" || action === "unconfirm_all") {
      assertRole(profile.role, ["operations"]);
      await assertNotInvoiceLocked(supabase, id, profile.role);

      const target = action === "confirm_all" ? "Confirmed" : "Pending";
      const patch: Record<string, unknown> = {};
      let touched = 0;

      for (const key of ["hotels", "flights", "others"] as const) {
        patch[key] = ((booking[key] as Svc[]) ?? []).map((s) => {
          if (s.status === "Cancelled") return s;
          touched += 1;
          return { ...s, status: target };
        });
      }

      patch.status = action === "confirm_all" ? "Supplier Confirmed" : "Pending Operations";
      patch.timeline = withTimeline(
        booking.timeline,
        actor,
        `All ${touched} service(s) marked ${action === "confirm_all" ? "confirmed" : "unconfirmed"}`,
      );

      const { error } = await supabase.from("bookings").update(patch).eq("id", id);
      if (error) throw new HttpError(500, error.message);
      return NextResponse.json(await bookingResponse(supabase, id, profile.role));
    }

    // ---------------- Service-level ----------------
    const { key, index } = parseRowId(rowId);
    const list = ((booking[key] as Svc[]) ?? []).slice();
    const svc = list[index];
    if (!svc) throw new HttpError(404, "Service not found");

    const saveList = async (nextList: Svc[], note: string) => {
      const nextBooking = { ...booking, [key]: nextList };
      const { error } = await supabase
        .from("bookings")
        .update({
          [key]: nextList,
          adjustments: rebuildAdjustments(nextBooking as never),
          timeline: withTimeline(booking.timeline, actor, note),
        })
        .eq("id", id);
      if (error) throw new HttpError(500, error.message);
      return NextResponse.json(await bookingResponse(supabase, id, profile.role));
    };

    const saveService = (updated: Svc, note: string) => {
      list[index] = updated;
      return saveList(list, note);
    };

    if (action === "remove_service") {
      assertRole(profile.role, ["sales", "operations"]);
      await assertNotInvoiceLocked(supabase, id, profile.role);
      return saveList(list.filter((_, i) => i !== index), `${key.slice(0, -1)} #${index + 1} removed`);
    }

    if (action === "set_labels") {
      return saveService({ ...svc, labels: labels ?? [] }, `Labels updated on ${key.slice(0, -1)} #${index + 1}`);
    }

    if (action === "set_charges") {
      assertRole(profile.role, ["sales", "operations", "accounts"]);
      await assertNotInvoiceLocked(supabase, id, profile.role);
      const incoming = charges ?? [];
      const cleaned = profile.role === "sales" ? incoming.filter((c) => c.bearer === "customer") : incoming;
      const recomputed = recomputeService(applySupplierCharges({ ...svc, charges: cleaned }), pax);
      return saveService(recomputed, `${cleaned.length} charge(s) saved on ${key.slice(0, -1)} #${index + 1}`);
    }

    if (action === "assign_supplier") {
      assertRole(profile.role, ["operations"]);
      await assertNotInvoiceLocked(supabase, id, profile.role);
      if (!supplier?.supplier_name) throw new HttpError(400, "Select a supplier");
      const recomputed = recomputeService({ ...svc, ...supplier }, pax);
      return saveService(recomputed, `Supplier "${supplier.supplier_name}" assigned to ${key.slice(0, -1)} #${index + 1}`);
    }

    if (action === "update_service") {
      assertRole(profile.role, ["sales", "operations"]);
      await assertNotInvoiceLocked(supabase, id, profile.role);
      if (booking.rates_locked && profile.role === "sales") {
        throw new HttpError(423, "Rates are locked — ask operations to update them");
      }

      const patch: Svc = { ...(fields ?? {}) };
      if (profile.role === "sales") {
        for (const f of Object.keys(patch)) if (SUPPLIER_EDIT_FIELDS.has(f)) delete patch[f];
      }
      delete patch.status;
      delete patch.charges;

      const recomputed = recomputeService(applySupplierCharges({ ...svc, ...patch }), pax);
      return saveService(recomputed, `${key.slice(0, -1)} #${index + 1} details updated`);
    }

    // ---------------- Status changes ----------------
    assertRole(profile.role, ["operations"]);
    await assertNotInvoiceLocked(supabase, id, profile.role);

    const nextStatus =
      action === "confirm_service"
        ? "Confirmed"
        : action === "unconfirm_service"
          ? "Pending"
          : action === "request_supplier"
            ? "Supplier Requested"
            : "Cancelled";

    if (action === "request_supplier" && !svc.supplier_name) throw new HttpError(400, "Assign a supplier first");
    if (svc.status === "Cancelled") throw new HttpError(409, "This service is already cancelled");

    list[index] = {
      ...svc,
      status: nextStatus,
      ...(action === "cancel_service" ? { cancelled_at: new Date().toISOString(), cancelled_by: actor } : {}),
    };

    const all = ["hotels", "flights", "others"].flatMap((k) => (k === key ? list : ((booking[k] as Svc[]) ?? [])));
    const live = all.filter((s) => s.status !== "Cancelled");
    const confirmed = live.filter((s) => s.status === "Confirmed").length;

    let bookingStatus = booking.status;
    if (live.length === 0) bookingStatus = "Cancelled";
    else if (confirmed === live.length) bookingStatus = "Supplier Confirmed";
    else if (confirmed > 0) bookingStatus = "Partially Confirmed";
    else if (all.some((s) => s.status === "Supplier Requested")) bookingStatus = "Supplier Pending";
    else bookingStatus = "Pending Operations";

    const { error } = await supabase
      .from("bookings")
      .update({
        [key]: list,
        status: bookingStatus,
        timeline: withTimeline(booking.timeline, actor, `${key.slice(0, -1)} #${index + 1} → ${nextStatus}`),
      })
      .eq("id", id);
    if (error) throw new HttpError(500, error.message);

    return NextResponse.json(await bookingResponse(supabase, id, profile.role));
  } catch (e) {
    return errorResponse(e);
  }
}
