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
  /** kis service se juda hai — "hotel:0" / "flight:1", ya null = poori booking */
  ref: string | null;
  amount: number | null;
  uploaded_by: string;
  uploaded_at: string;
}

/** Supplier bill sirf operations / accounts / admin dekh sakte hain. */
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
    if (!profile) throw new HttpError(401, "Login karo");

    const booking = await getBookingOr404(supabase, id);
    const list = readList(booking).filter((a) => visibleTo(profile.role, a));

    // Bucket private hai — har file ka 1 ghante ka signed URL banate hain.
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
    if (!profile) throw new HttpError(401, "Login karo");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "File nahi mili");
    if (file.size === 0) throw new HttpError(400, "File khaali hai");
    if (file.size > MAX_BYTES) throw new HttpError(413, "File 10 MB se badi hai");
    if (file.type && !ALLOWED.includes(file.type)) {
      throw new HttpError(415, "Sirf JPG, PNG, WEBP ya PDF chalega");
    }

    const category = (String(form.get("category") ?? "other") || "other") as AttachmentCategory;
    const ref = form.get("ref") ? String(form.get("ref")) : null;
    const amountRaw = form.get("amount");
    const amount = amountRaw !== null && String(amountRaw) !== "" ? Number(amountRaw) : null;

    // Supplier bill sirf operations/accounts/admin upload kar sakte hain.
    if (category === "supplier_bill") assertRole(profile.role, ["operations", "accounts"]);

    const booking = await getBookingOr404(supabase, id);

    const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-80);
    const attId = `at_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    // Path: {tenant_id}/{booking_id}/{file} — storage policy isi par chalti hai.
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
    if (!profile) throw new HttpError(401, "Login karo");
    assertRole(profile.role, ["operations", "accounts"]);

    const { fileId } = (await req.json()) as { fileId?: string };
    if (!fileId) throw new HttpError(400, "fileId chahiye");

    const booking = await getBookingOr404(supabase, id);
    const list = readList(booking);
    const target = list.find((a) => a.id === fileId);
    if (!target) throw new HttpError(404, "File nahi mili");

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
