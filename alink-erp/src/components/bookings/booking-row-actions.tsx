"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { can } from "@/lib/booking-actions";
import { SendConfirmationDialog } from "@/components/bookings/send-confirmation-dialog";
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
      onSelect: () => go(`/bookings/new?edit=${booking.id}`),
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
      key: "delete",
      label: "Delete booking",
      hidden: !can(role, []), // admin / super_admin only
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

    </>
  );
}
