"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Clock, Paperclip, Phone } from "lucide-react";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { numPaxOf, statusColor } from "@/lib/bookings";
import {
  can,
  isBookingLocked,
  serviceStatusColor,
  toServiceRows,
  type ServiceRow,
} from "@/lib/booking-actions";
import { customerChargeTotal, readCharges, type Charge } from "@/lib/booking-charges";
import type { Booking, Role } from "@/lib/types";
import { LabelDialog } from "@/components/bookings/label-dialog";
import { ServiceDetailDrawer } from "@/components/bookings/service-detail-drawer";
import { ServiceEditDialog } from "@/components/bookings/service-edit-dialog";
import { ChargesDialog } from "@/components/bookings/charges-dialog";
import { AttachmentsDialog } from "@/components/bookings/attachments-dialog";

interface Props {
  booking: Booking;
  role: Role;
  demoExpiresOn?: string | null;
}

const inr = (n: number | undefined) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function BookingDetailView({ booking, role, demoExpiresOn }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const [labelRow, setLabelRow] = useState<ServiceRow | null>(null);
  const [detailRow, setDetailRow] = useState<ServiceRow | null>(null);
  const [chargesRow, setChargesRow] = useState<ServiceRow | null>(null);
  const [editRow, setEditRow] = useState<{ row: ServiceRow; focus: "supplier" | "extras" | null } | null>(null);
  const [filesFor, setFilesFor] = useState<{ row: ServiceRow | null } | null>(null);

  const rows = useMemo(() => toServiceRows(booking), [booking]);
  const pax = useMemo(() => numPaxOf(booking as never), [booking]);
  const attachmentCount = (booking as unknown as { attachments?: unknown[] }).attachments?.length ?? 0;

  const locked = isBookingLocked(booking);
  const lockReason = booking.invoice_id
    ? `Invoice ${booking.invoice_number ?? ""} bana hua hai — pehle usse clear karo`
    : "Booking completed/closed hai — pehle reopen karo";

  async function run(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      if (json.redirect) router.push(json.redirect as string);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kuch galat ho gaya");
    } finally {
      setBusy(null);
    }
  }

  const go = (path: string) => router.push(path);
  const openPrint = (path: string) => window.open(path, "_blank", "noopener");

  // ---------------- Header gear ----------------
  const bookingActions: ActionMenuItem[] = [
    {
      key: "send-confirmation",
      label: "Send confirmation",
      hidden: !can(role, ["sales", "operations"]),
      onSelect: () => run({ action: "send_confirmation" }, "send-confirmation"),
    },
    {
      key: "print-confirmation",
      label: "Print confirmation",
      onSelect: () => openPrint(`/bookings/${booking.id}/print/confirmation`),
    },
    {
      key: "confirm-all",
      label: "Confirm all services",
      hidden: !can(role, ["operations"]),
      disabled: locked || rows.length === 0,
      reason: rows.length === 0 ? "Abhi koi service add nahi hui" : lockReason,
      onSelect: () => run({ action: "confirm_all" }, "confirm-all"),
    },
    {
      key: "unconfirm-all",
      label: "Mark as unconfirmed",
      hidden: !can(role, ["operations"]),
      disabled: locked,
      reason: lockReason,
      onSelect: () => run({ action: "unconfirm_all" }, "unconfirm-all"),
    },
    {
      key: "files",
      label: `Attach file / bills${attachmentCount ? ` (${attachmentCount})` : ""}`,
      separatorBefore: true,
      onSelect: () => setFilesFor({ row: null }),
    },
    {
      key: "export",
      label: "Export services",
      onSelect: () => openPrint(`/api/bookings/${booking.id}/export`),
    },
    {
      key: "advance",
      label: "Add advance payment receipt",
      hidden: !can(role, ["accounts"]),
      onSelect: () => go(`/payments/new?booking=${booking.id}&type=customer`),
    },
    {
      key: "briefing",
      label: "Create briefing sheet",
      hidden: !can(role, ["operations"]),
      onSelect: () => openPrint(`/bookings/${booking.id}/print/briefing`),
    },
    {
      key: "invoice",
      label: booking.invoice_id ? "View invoice" : "Generate invoice",
      hidden: !can(role, ["accounts"]),
      separatorBefore: true,
      onSelect: () =>
        booking.invoice_id ? go(`/invoices/${booking.invoice_id}`) : go(`/invoices/new?booking=${booking.id}`),
    },
    {
      key: "delete",
      label: "Delete booking",
      hidden: !can(role, []),
      danger: true,
      separatorBefore: true,
      disabled: !!booking.invoice_id,
      reason: "Invoice attached hai — pehle invoice delete karo",
      onSelect: () => {
        if (confirm(`Booking ${booking.booking_number} delete kar dein? Ye wapas nahi aayegi.`))
          run({ action: "delete_booking" }, "delete");
      },
    },
  ];

  // ---------------- Row gear ----------------
  function rowActions(row: ServiceRow): ActionMenuItem[] {
    const confirmed = row.status === "Confirmed";
    const cancelled = row.status === "Cancelled";
    const voucherPath =
      row.kind === "flight"
        ? `/bookings/${booking.id}/print/eticket?row=${row.rowId}`
        : `/bookings/${booking.id}/print/voucher?row=${row.rowId}`;

    return [
      { key: "details", label: "Details", onSelect: () => setDetailRow(row) },
      {
        key: "toggle-confirm",
        label: confirmed ? "Unconfirm service" : "Confirm service",
        hidden: !can(role, ["operations"]),
        disabled: locked || cancelled,
        reason: cancelled ? "Ye service cancel ho chuki hai" : lockReason,
        onSelect: () =>
          run({ action: confirmed ? "unconfirm_service" : "confirm_service", rowId: row.rowId }, `c-${row.rowId}`),
      },
      { key: "labels", label: "Add/Remove labels", onSelect: () => setLabelRow(row) },
      {
        key: "edit",
        label: row.kind === "flight" ? "Edit flight" : row.kind === "hotel" ? "Edit hotel" : "Edit service",
        hidden: !can(role, ["sales", "operations"]),
        disabled: locked || cancelled,
        reason: cancelled ? "Cancelled service edit nahi hoti" : lockReason,
        onSelect: () => setEditRow({ row, focus: null }),
      },
      {
        key: "charges",
        label: "Add charges",
        separatorBefore: true,
        disabled: locked || cancelled,
        reason: lockReason,
        onSelect: () => setChargesRow(row),
      },
      {
        key: "bills",
        label: row.kind === "flight" ? "Upload ticket / bill" : "Upload voucher / bill",
        onSelect: () => setFilesFor({ row }),
      },
      {
        key: "supplier",
        label: row.supplierName ? "Change supplier" : "Assign supplier",
        hidden: !can(role, ["operations"]),
        separatorBefore: true,
        disabled: locked || cancelled,
        reason: cancelled ? "Cancelled service ko supplier nahi lagta" : lockReason,
        onSelect: () => setEditRow({ row, focus: "supplier" }),
      },
      {
        key: "send-supplier",
        label: "Send to supplier",
        hidden: !can(role, ["operations"]),
        disabled: !row.supplierName || cancelled,
        reason: "Pehle supplier assign karo",
        onSelect: () => run({ action: "request_supplier", rowId: row.rowId }, `r-${row.rowId}`),
      },
      {
        key: "extras",
        label: row.kind === "flight" ? "Add seat / meal / baggage" : "Add extra services",
        hidden: !can(role, ["sales", "operations"]),
        disabled: locked || cancelled,
        reason: lockReason,
        onSelect: () => setEditRow({ row, focus: "extras" }),
      },
      {
        key: "voucher",
        label: row.kind === "flight" ? "Print e-ticket" : "Print voucher",
        separatorBefore: true,
        onSelect: () => openPrint(voucherPath),
      },
      {
        key: "cancel",
        label: row.kind === "flight" ? "Cancel flight" : row.kind === "hotel" ? "Cancel hotel" : "Cancel service",
        hidden: !can(role, ["operations"]),
        danger: true,
        disabled: locked || cancelled,
        reason: cancelled ? "Already cancelled" : lockReason,
        onSelect: () => {
          if (confirm(`"${row.title}" cancel kar dein?`))
            run({ action: "cancel_service", rowId: row.rowId }, `x-${row.rowId}`);
        },
      },
    ];
  }

  const fin = booking.financials;

  return (
    <div className="min-h-screen bg-white">
      {demoExpiresOn && (
        <div className="bg-red-500 px-4 py-2 text-center text-sm font-medium text-white">
          This is a demo version and will expire on {demoExpiresOn}.{" "}
          <Link href="/upgrade" className="underline">
            Click here to get complete access.
          </Link>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/bookings")}
            aria-label="Back to bookings"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-800">
            Booking #{booking.booking_number}
          </h1>

          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(booking.status)}`}>
            {booking.status}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {attachmentCount > 0 && (
              <button
                type="button"
                onClick={() => setFilesFor({ row: null })}
                className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <Paperclip className="h-4 w-4" />
                {attachmentCount}
              </button>
            )}
            {can(role, ["sales", "operations"]) && (
              <Link
                href={`/bookings/${booking.id}/edit`}
                className={`rounded bg-blue-600 px-6 py-2.5 text-sm font-semibold tracking-wide text-white hover:bg-blue-700 ${
                  locked ? "pointer-events-none opacity-40" : ""
                }`}
                title={locked ? lockReason : undefined}
              >
                EDIT
              </Link>
            )}
            <ActionMenu items={bookingActions} variant="gear" label="Booking actions" />
          </div>
        </div>

        {/* Summary */}
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 border-t border-slate-200 pt-3 text-sm text-slate-500">
          <span>
            Customer: <span className="text-slate-800">{booking.customer_snapshot?.name ?? "—"}</span>
          </span>
          <span>
            Destination: <span className="text-slate-800">{booking.destination ?? "—"}</span>
          </span>
          <span>
            Travel:{" "}
            <span className="text-slate-800">
              {(booking.travel_start_date ?? "—").slice(0, 10)} → {(booking.travel_end_date ?? "—").slice(0, 10)}
            </span>
          </span>
          <span>
            Pax: <span className="text-slate-800">{pax}</span>
          </span>
          <span>
            Sales exec: <span className="text-slate-800">{booking.sales_executive_name ?? "Unassigned"}</span>
          </span>
        </div>

        {error && (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {/* Services table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-[15px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-700">
                <th className="py-3 pl-3 pr-2 font-semibold">Date ▲</th>
                <th className="px-2 py-3 font-semibold">Customer</th>
                <th className="px-2 py-3 font-semibold">Passenger</th>
                <th className="px-2 py-3 font-semibold">Service</th>
                <th className="px-2 py-3 font-semibold">Supplier</th>
                <th className="px-2 py-3 font-semibold">Type</th>
                <th className="px-2 py-3 font-semibold">Address / Sector</th>
                <th className="px-2 py-3 font-semibold">City</th>
                <th className="px-2 py-3 font-semibold">Time</th>
                <th className="px-2 py-3 text-right font-semibold">Charges</th>
                <th className="px-2 py-3 font-semibold">Status</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-14 text-center text-slate-500">
                    Is booking me abhi koi service nahi hai.{" "}
                    <Link href={`/bookings/${booking.id}/edit`} className="text-blue-600 hover:underline">
                      Hotel ya flight add karo
                    </Link>
                    .
                  </td>
                </tr>
              )}

              {rows.map((row) => {
                const pending = row.status !== "Confirmed" && row.status !== "Cancelled";
                const charges = readCharges(row.raw);
                return (
                  <tr
                    key={row.rowId}
                    onDoubleClick={() => setDetailRow(row)}
                    className={[
                      "border-b border-slate-100 align-middle",
                      row.status === "Cancelled"
                        ? "bg-slate-50 text-slate-400 line-through decoration-slate-300"
                        : pending
                          ? "bg-rose-50 hover:bg-rose-100"
                          : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <td className="py-3 pl-3 pr-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <Phone className="h-4 w-4 text-emerald-600" />
                        {row.date ? `${row.date.slice(8, 10)}-${row.date.slice(5, 7)}` : "—"}
                      </span>
                    </td>
                    <td className="px-2 py-3">{row.customer || "Walk-in"}</td>
                    <td className="px-2 py-3">{row.passenger || "—"}</td>
                    <td className="px-2 py-3 italic">{row.title}</td>
                    <td className="px-2 py-3">
                      {can(role, ["operations", "accounts"]) ? (row.supplierName ?? "-") : "—"}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">{row.detail}</td>
                    <td className="max-w-[220px] truncate px-2 py-3" title={row.address}>
                      {row.address || "—"}
                    </td>
                    <td className="px-2 py-3">{row.city || "—"}</td>
                    <td className="px-2 py-3">{row.time ?? "—"}</td>
                    <td className="px-2 py-3 text-right">
                      {charges.length ? (
                        <button
                          type="button"
                          onClick={() => setChargesRow(row)}
                          className="text-blue-600 hover:underline"
                          title={charges.map((c: Charge) => `${c.label}: ${inr(c.amount)}`).join("\n")}
                        >
                          {inr(customerChargeTotal(charges))}
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {!row.supplierName && row.status !== "Cancelled" && can(role, ["operations"]) ? (
                        <button
                          type="button"
                          onClick={() => setEditRow({ row, focus: "supplier" })}
                          className="rounded bg-emerald-600 px-3 py-1 text-xs font-bold tracking-wide text-white hover:bg-emerald-700"
                        >
                          ASSIGN
                        </button>
                      ) : (
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${serviceStatusColor(row.status)}`}>
                          {row.status}
                        </span>
                      )}
                      {row.labels.length > 0 && (
                        <span className="ml-2 space-x-1">
                          {row.labels.map((l) => (
                            <span key={l} className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-700">
                              {l}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <ActionMenu items={rowActions(row)} variant="row" label={`Actions for ${row.title}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {busy && <p className="mt-3 text-sm text-slate-500">Working…</p>}

        {/* Financial summary */}
        {fin && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Total sales</p>
              <p className="text-lg font-semibold text-slate-800">{inr(fin.total_sales)}</p>
            </div>
            {can(role, ["operations", "accounts"]) && (
              <>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Supplier cost</p>
                  <p className="text-lg font-semibold text-slate-800">{inr(fin.total_supplier_cost)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Gross profit</p>
                  <p className="text-lg font-semibold text-emerald-700">{inr(fin.gross_profit)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Margin</p>
                  <p className="text-lg font-semibold text-slate-800">{Number(fin.margin ?? 0).toFixed(1)}%</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Activity log */}
        <div className="mt-6 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <Clock className="h-4 w-4" />
            {showLogs ? "Hide Activity Logs" : "View Activity Logs"}
          </button>

          {showLogs && (
            <ol className="mt-3 space-y-2 border-l border-slate-200 pl-4 text-sm">
              {(booking.timeline ?? []).length === 0 && (
                <li className="text-slate-500">Abhi koi activity record nahi hui.</li>
              )}
              {[...(booking.timeline ?? [])].reverse().map((t, i) => (
                <li key={`${t.at}-${i}`} className="text-slate-600">
                  <span className="text-slate-400">{t.at.replace("T", " ").slice(0, 16)}</span> — {t.action}{" "}
                  <span className="text-slate-400">by {t.by}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {labelRow && (
        <LabelDialog
          row={labelRow}
          onClose={() => setLabelRow(null)}
          onSave={async (labels) => {
            await run({ action: "set_labels", rowId: labelRow.rowId, labels }, "labels");
            setLabelRow(null);
          }}
        />
      )}

      {detailRow && <ServiceDetailDrawer row={detailRow} role={role} onClose={() => setDetailRow(null)} />}

      {chargesRow && (
        <ChargesDialog
          row={chargesRow}
          role={role}
          onClose={() => setChargesRow(null)}
          onSave={async (charges) => {
            await run({ action: "set_charges", rowId: chargesRow.rowId, charges }, "charges");
            setChargesRow(null);
          }}
        />
      )}

      {editRow && (
        <ServiceEditDialog
          row={editRow.row}
          role={role}
          numPax={pax}
          focus={editRow.focus}
          onClose={() => setEditRow(null)}
          onSave={async (fields) => {
            await run({ action: "update_service", rowId: editRow.row.rowId, fields }, "edit");
            setEditRow(null);
          }}
        />
      )}

      {filesFor && (
        <AttachmentsDialog
          bookingId={booking.id}
          row={filesFor.row}
          role={role}
          onClose={() => setFilesFor(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}
