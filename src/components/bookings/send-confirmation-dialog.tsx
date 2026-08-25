"use client";

import { useEffect, useState } from "react";
import { Mail, MessageCircle, X } from "lucide-react";

type Channel = "email" | "whatsapp";

export function SendConfirmationDialog({
  bookingId,
  onClose,
  onSent,
}: {
  bookingId: string;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [available, setAvailable] = useState<Channel[]>([]);
  const [picked, setPicked] = useState<Channel[]>([]);
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<{ channel: string; ok: boolean; detail: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/bookings/${bookingId}/notify`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.error) throw new Error(j.error);
        setAvailable(j.channels ?? []);
        setPicked(j.channels ?? []);
        setEmail(j.email ?? "");
        setMobile(j.mobile ?? "");
        setMessage(j.message ?? "");
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Load fail"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [bookingId]);

  const toggle = (c: Channel) =>
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: picked, email, mobile, message }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Send fail");
      setResults(j.results ?? []);
      if (j.anySent) onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send fail");
    } finally {
      setSending(false);
    }
  }

  const chip = (c: Channel, label: string, Icon: typeof Mail) => {
    const on = picked.includes(c);
    const has = available.includes(c);
    return (
      <button
        key={c}
        type="button"
        disabled={!has}
        onClick={() => toggle(c)}
        title={has ? undefined : "This channel is not configured in .env"}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
          !has
            ? "cursor-not-allowed border-slate-200 text-slate-300"
            : on
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-slate-300 text-slate-600 hover:border-slate-400"
        }`}
      >
        <Icon className="h-4 w-4" /> {label}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Send confirmation</h2>
            <p className="text-sm text-slate-500">Send the booking details to the customer</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}

          {!loading && available.length === 0 && (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No channel is configured. Add Resend (email) or WhatsApp keys to <code>.env.local</code>,
              then restart the server.
            </p>
          )}

          <div className="flex gap-2">
            {chip("email", "Email", Mail)}
            {chip("whatsapp", "WhatsApp", MessageCircle)}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Email to</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@email.com"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">WhatsApp number</span>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="98xxxxxxxx"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Message (editable)</span>
            <textarea
              rows={12}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {results && (
            <ul className="space-y-1 rounded bg-slate-50 p-3 text-sm">
              {results.map((r, i) => (
                <li key={i} className={r.ok ? "text-emerald-700" : "text-red-600"}>
                  {r.ok ? "✓" : "✕"} {r.detail}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Close
          </button>
          <button
            type="button"
            disabled={sending || picked.length === 0 || !message.trim()}
            onClick={send}
            className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send now"}
          </button>
        </div>
      </div>
    </div>
  );
}
