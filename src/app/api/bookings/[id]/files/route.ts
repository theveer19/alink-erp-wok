import { NextResponse } from "next/server";
import { assertRole, errorResponse, getSessionProfile, HttpError } from "@/lib/auth";
import { getBookingOr404, withTimeline } from "@/lib/booking-service.server";

const BUCKET = "booking-files";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

export type AttachmentCategory =
  | "supplier_bill"
  | "voucher"
  | "customer_receipt"
  | "ticket"
  | "other";

export interface Attachment {
  id: string;
  path: string;
  name: string;
  size: number;
  type: string;
  category: AttachmentCategory;
  /** Which service it belongs to — "hotel:0" / "flight:1", or null for the whole booking */
  ref: string | null;
  amount: number | null;
  uploaded_by: string;
  uploaded_at: string;
}

/** Supplier bills are visible to operations / accounts / admin only. */
function visibleTo(role: string, a: Attachment) {
  if (role === "admin" || role === "super_admin" || role === "operations" || role === "accounts")
    return true;
  return a.category !== "supplier_bill";
}

const readList = (b: Record<string, unknown>): Attachment[] =>
  Array.isArray(b.attachments) ? (b.attachments as Attachment[]) : [];

// ---------------------------------------------------------------- GET (list)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");

    const booking = await getBookingOr404(supabase, id);
    const list = readList(booking).filter((a) => visibleTo(profile.role, a));

    // The bucket is private — sign each file for one hour.
    const files = await Promise.all(
      list.map(async (a) => {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(a.path, 3600);
        return { ...a, url: data?.signedUrl ?? null };
      }),
    );

    return NextResponse.json({ files });
  } catch (e) {
    return errorResponse(e);
  }
}

// ------------------------------------------------------------- POST (upload)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "File not found");
    if (file.size === 0) throw new HttpError(400, "The file is empty");
    if (file.size > MAX_BYTES) throw new HttpError(413, "File is larger than 10 MB");
    if (file.type && !ALLOWED.includes(file.type)) {
      throw new HttpError(415, "Only JPG, PNG, WEBP or PDF is allowed");
    }

    const category = (String(form.get("category") ?? "other") || "other") as AttachmentCategory;
    const ref = form.get("ref") ? String(form.get("ref")) : null;
    const amountRaw = form.get("amount");
    const amount = amountRaw !== null && String(amountRaw) !== "" ? Number(amountRaw) : null;

    // Only operations/accounts/admin may upload a supplier bill.
    if (category === "supplier_bill") assertRole(profile.role, ["operations", "accounts"]);

    const booking = await getBookingOr404(supabase, id);

    const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-80);
    const attId = `at_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    // Path: {tenant_id}/{booking_id}/{file} — the storage policy relies on this.
    const path = `${profile.tenant_id}/${id}/${attId}-${safeName}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) throw new HttpError(500, `Upload fail: ${upErr.message}`);

    const attachment: Attachment = {
      id: attId,
      path,
      name: safeName,
      size: file.size,
      type: file.type || "application/octet-stream",
      category,
      ref,
      amount: Number.isFinite(amount as number) ? (amount as number) : null,
      uploaded_by: profile.name || profile.email || "system",
      uploaded_at: new Date().toISOString(),
    };

    const next = [...readList(booking), attachment];
    const { error } = await supabase
      .from("bookings")
      .update({
        attachments: next,
        timeline: withTimeline(
          booking.timeline,
          attachment.uploaded_by,
          `File uploaded: ${safeName}${ref ? ` (${ref})` : ""}`,
        ),
      })
      .eq("id", id);
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]); // rollback
      throw new HttpError(500, error.message);
    }

    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    return NextResponse.json({ file: { ...attachment, url: signed?.signedUrl ?? null } });
  } catch (e) {
    return errorResponse(e);
  }
}

// ----------------------------------------------------------- DELETE (remove)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { profile, supabase } = await getSessionProfile();
    if (!profile) throw new HttpError(401, "Please sign in");
    assertRole(profile.role, ["operations", "accounts"]);

    const { fileId } = (await req.json()) as { fileId?: string };
    if (!fileId) throw new HttpError(400, "fileId is required");

    const booking = await getBookingOr404(supabase, id);
    const list = readList(booking);
    const target = list.find((a) => a.id === fileId);
    if (!target) throw new HttpError(404, "File not found");

    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([target.path]);
    if (rmErr) throw new HttpError(500, rmErr.message);

    const { error } = await supabase
      .from("bookings")
      .update({
        attachments: list.filter((a) => a.id !== fileId),
        timeline: withTimeline(
          booking.timeline,
          profile.name || profile.email || "system",
          `File deleted: ${target.name}`,
        ),
      })
      .eq("id", id);
    if (error) throw new HttpError(500, error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
