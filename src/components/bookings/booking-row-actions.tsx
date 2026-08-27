"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { can } from "@/lib/booking-actions";
import { SendConfirmationDialog } from "@/components/bookings/send-confirmation-dialog";
import { PaymentDialog } from "@/components/bookings/payment-dialog";
import { InvoiceDialog } from "@/components/bookings/invoice-dialog";
import type { Role } from "@/lib/types";

export interface RowBooking {
  id: string;
  booking_number: string;
  status: string;
  invoice_id?: string | null;
  rates_locked?: boolean | null;
}

/**
 * The gear that sits at the end of every row on the bookings list.
 * Opens on hover; everything happens in place, without leaving the list.
 */
export function BookingRowActions({
  booking,
  role,
  onChanged,
}: {
  booking: RowBooking;
  role: Role;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const locked = ["Completed", "Closed", "Cancelled"].includes(booking.status) || !!booking.invoice_id;
  const lockReason = booking.invoice_id
    ? "An invoice already exists — clear it first"
    : "This booking is completed or closed — reopen it first";

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      if (json.redirect) router.push(json.redirect as string);
      else {
        router.refresh();
        onChanged?.();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const go = (path: string) => router.push(path);
  const openPrint = (path: string) => window.open(path, "_blank", "noopener");

  const items: ActionMenuItem[] = [
    { key: "open", label: "Open booking", onSelect: () => go(`/bookings/${booking.id}`) },
    {
      key: "edit",
      label: "Edit booking",
      hidden: !can(role, ["sales", "operations"]),
      disabled: locked || busy,
      reason: lockReason,
      onSelect: () => go(`/bookings/${booking.id}/edit`),
    },
    {
      key: "send",
      label: "Send confirmation",
      hidden: !can(role, ["sales", "operations"]),
      separatorBefore: true,
      onSelect: () => setSendOpen(true),
    },
    {
      key: "print",
      label: "Print confirmation",
      onSelect: () => openPrint(`/bookings/${booking.id}/print/confirmation`),
    },
    {
      key: "voucher",
      label: "Print voucher / e-ticket",
      onSelect: () => openPrint(`/bookings/${booking.id}/print/voucher`),
    },
    {
      key: "confirm-all",
      label: "Confirm all services",
      hidden: !can(role, ["operations"]),
      separatorBefore: true,
      disabled: locked || busy,
      reason: lockReason,
      onSelect: () => run({ action: "confirm_all" }),
    },
    {
      key: "lock",
      label: booking.rates_locked ? "Unlock rates" : "Lock rates",
      hidden: !can(role, ["operations"]),
      disabled: busy,
      onSelect: () => run({ action: booking.rates_locked ? "unlock_rates" : "lock_rates" }),
    },
    {
      key: "advance",
      label: "Add advance payment receipt",
      hidden: !can(role, ["accounts"]),
      separatorBefore: true,
      onSelect: () => setPayOpen(true),
    },
    {
      key: "invoice",
      label: booking.invoice_id ? "View invoice" : "Generate invoice",
      hidden: !can(role, ["accounts"]),
      onSelect: () => (booking.invoice_id ? go(`/invoices/${booking.invoice_id}`) : setInvoiceOpen(true)),
    },
    {
      key: "duplicate",
      label: "Duplicate booking",
      hidden: !can(role, ["sales", "operations"]),
      separatorBefore: true,
      disabled: busy,
      onSelect: () => {
        if (confirm("Create a new booking with the same customer and services?"))
          run({ action: "duplicate_booking" });
      },
    },
    {
      key: "close",
      label: "Close booking",
      hidden: !can(role, ["operations", "accounts"]),
      disabled: locked || busy,
      reason: lockReason,
      onSelect: () => {
        if (confirm("Close this booking? It cannot be edited afterwards (an admin can reopen it)."))
          run({ action: "close_booking" });
      },
    },
    {
      key: "reopen",
      label: "Reopen booking",
      hidden: !can(role, []),
      disabled: !locked || busy,
      reason: "This booking is already open",
      onSelect: () => run({ action: "reopen_booking" }),
    },
    {
      key: "delete",
      label: "Delete booking",
      hidden: !can(role, []),
      danger: true,
      separatorBefore: true,
      disabled: !!booking.invoice_id || busy,
      reason: "An invoice is attached — delete the invoice first",
      onSelect: () => {
        if (confirm(`Delete booking ${booking.booking_number}? This cannot be undone.`))
          run({ action: "delete_booking" });
      },
    },
  ];

  return (
    <>
      <ActionMenu items={items} variant="row" label={`Actions for ${booking.booking_number}`} />

      {sendOpen && (
        <SendConfirmationDialog
          bookingId={booking.id}
          onClose={() => setSendOpen(false)}
          onSent={() => {
            router.refresh();
            onChanged?.();
          }}
        />
      )}

      {payOpen && (
        <PaymentDialog
          bookingId={booking.id}
          onClose={() => setPayOpen(false)}
          onSaved={() => {
            router.refresh();
            onChanged?.();
          }}
        />
      )}

      {invoiceOpen && (
        <InvoiceDialog
          bookingId={booking.id}
          onClose={() => setInvoiceOpen(false)}
          onCreated={(redirect) => {
            setInvoiceOpen(false);
            router.push(redirect);
          }}
        />
      )}
    </>
  );
}
