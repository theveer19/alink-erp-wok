import { errorResponse, getSessionProfile, HttpError } from "@/lib/auth";
import { getBookingOr404 } from "@/lib/booking-service.server";
import { toServiceRows } from "@/lib/booking-actions";
import { customerChargeTotal, readCharges } from "@/lib/booking-charges";
import type { Booking } from "@/lib/types";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Login karo");

    const booking = (await getBookingOr404(supabase, id)) as Booking;
    const rows = toServiceRows(booking);
    const showCost = ["admin", "super_admin", "operations", "accounts"].includes(profile.role);

    const header = [
      "Type",
      "Date",
      "End date",
      "Time",
      "Customer",
      "Passenger",
      "Service",
      "Details",
      "Address/Sector",
      "City",
      "Status",
      "Extra charges",
      "Selling amount",
      ...(showCost ? ["Supplier", "Supplier cost", "Profit"] : []),
    ];

    const lines = [header.join(",")];

    for (const r of rows) {
      const cells = [
        r.kind,
        r.date ?? "",
        r.endDate ?? "",
        r.time ?? "",
        r.customer,
        r.passenger,
        r.title,
        r.detail,
        r.address,
        r.city,
        r.status,
        customerChargeTotal(readCharges(r.raw)),
        Number(r.raw.customer_selling_amount ?? 0),
        ...(showCost
          ? [r.supplierName ?? "", Number(r.raw.total_supplier_cost ?? 0), Number(r.raw.profit ?? 0)]
          : []),
      ];
      lines.push(cells.map(esc).join(","));
    }

    // BOM taaki Excel me Hindi/₹ theek dikhe.
    const csv = "\uFEFF" + lines.join("\r\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="booking-${booking.booking_number}-services.csv"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
