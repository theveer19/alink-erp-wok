// Single place for sending email / WhatsApp.
// Providers come from env — a channel without keys is disabled automatically,
// so the app never crashes when keys are absent.
//
// Add to .env.local:
//   RESEND_API_KEY=re_xxx
//   NOTIFY_FROM_EMAIL="Alink Travels <bookings@yourdomain.com>"
//   WHATSAPP_TOKEN=EAAxxx
//   WHATSAPP_PHONE_ID=1234567890
//   WHATSAPP_TEMPLATE=booking_confirmation      (optional; falls back to plain text)
//   COMPANY_NAME="Alink Travels"

export type Channel = "email" | "whatsapp";

export function availableChannels(): Channel[] {
  const list: Channel[] = [];
  if (process.env.RESEND_API_KEY && process.env.NOTIFY_FROM_EMAIL) list.push("email");
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) list.push("whatsapp");
  return list;
}

const inr = (n: unknown) => `Rs. ${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const d = (v: unknown) => (v ? String(v).slice(0, 10) : "-");

interface Line {
  kind: string;
  title: string;
  date: string | null;
  detail: string;
  city: string;
  status: string;
}

export interface ConfirmationInput {
  bookingNumber: string;
  customerName: string;
  destination: string | null;
  travelStart: string | null;
  travelEnd: string | null;
  pax: number;
  lines: Line[];
  total: number | undefined;
}

/** Plain text — used as the base for both WhatsApp and email. */
export function buildConfirmationText(b: ConfirmationInput): string {
  const company = process.env.COMPANY_NAME ?? "Our travel desk";
  const services = b.lines
    .map((l, i) => `${i + 1}. [${l.kind.toUpperCase()}] ${l.title}\n   ${d(l.date)} | ${l.detail}${l.city ? ` | ${l.city}` : ""} | ${l.status}`)
    .join("\n");

  return [
    `Dear ${b.customerName || "Guest"},`,
    ``,
    `Your booking ${b.bookingNumber} is being confirmed.`,
    `Destination: ${b.destination ?? "-"}`,
    `Travel: ${d(b.travelStart)} to ${d(b.travelEnd)} | Pax: ${b.pax}`,
    ``,
    `Services:`,
    services || "(details shortly)",
    ``,
    b.total !== undefined ? `Total: ${inr(b.total)}` : "",
    ``,
    `Reply to this message for any changes.`,
    `- ${company}`,
  ]
    .filter((x) => x !== null)
    .join("\n");
}

function htmlFrom(text: string, bookingNumber: string): string {
  const body = text
    .split("\n")
    .map((l) => (l.trim() === "" ? "<br/>" : `<div>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`))
    .join("");
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;color:#1e293b;line-height:1.6">
    <h2 style="margin:0 0 12px;font-size:18px">Booking ${bookingNumber}</h2>${body}</div>`;
}

export interface SendResult {
  channel: Channel;
  ok: boolean;
  detail: string;
}

export async function sendEmail(to: string, subject: string, text: string, bookingNumber: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;
  if (!key || !from) return { channel: "email", ok: false, detail: "Email is not configured (RESEND_API_KEY / NOTIFY_FROM_EMAIL)" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, html: htmlFrom(text, bookingNumber) }),
    });
    if (!res.ok) {
      const j = await res.text();
      return { channel: "email", ok: false, detail: `Resend: ${j.slice(0, 200)}` };
    }
    return { channel: "email", ok: true, detail: `Email sent to ${to}` };
  } catch (e) {
    return { channel: "email", ok: false, detail: e instanceof Error ? e.message : "Email fail" };
  }
}

/** Normalises a mobile number to E.164 — default country code +91. */
export function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

export async function sendWhatsApp(toRaw: string, text: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId)
    return { channel: "whatsapp", ok: false, detail: "WhatsApp is not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID)" };

  const to = normalizeMobile(toRaw);
  if (to.length < 11) return { channel: "whatsapp", ok: false, detail: "That mobile number is not valid" };

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: text.slice(0, 4000) },
      }),
    });
    if (!res.ok) {
      const j = await res.text();
      return { channel: "whatsapp", ok: false, detail: `WhatsApp: ${j.slice(0, 200)}` };
    }
    return { channel: "whatsapp", ok: true, detail: `WhatsApp sent to +${to}` };
  } catch (e) {
    return { channel: "whatsapp", ok: false, detail: e instanceof Error ? e.message : "WhatsApp fail" };
  }
}
