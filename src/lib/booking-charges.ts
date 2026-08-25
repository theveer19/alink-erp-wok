// Extra charges — the "duty charges" concept, adapted for hotel/flight travel.
// Charges live in the service's `charges[]`. To keep the numbers correct we
// derive the following on every save:
//   bearer "supplier" -> service.other_charges  (counts towards total_supplier_cost)
//   bearer "customer" -> booking.adjustments[]  (counts towards total_sales)
// computeFinancials / recomputeService are left untouched.

export interface Charge {
  id: string;
  label: string;
  amount: number;
  bearer: "customer" | "supplier";
  remarks?: string;
}

/** Everyday charges for this business — used as dropdown suggestions. */
export const CHARGE_PRESETS = [
  "Extra bed",
  "Early check-in",
  "Late check-out",
  "Extra meal / meal plan upgrade",
  "Airport transfer",
  "Intercity transfer",
  "Toll / parking",
  "Driver allowance",
  "Sightseeing / entry ticket",
  "Visa fee",
  "Travel insurance",
  "Seat selection",
  "Excess baggage",
  "Date change fee",
  "Cancellation charge",
  "Service charge",
  "Discount",
] as const;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown) => Number(v || 0);

export function newChargeId(): string {
  return `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function readCharges(svc: Record<string, unknown> | null | undefined): Charge[] {
  const raw = svc?.charges;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const o = c as Record<string, unknown>;
      return {
        id: String(o.id ?? newChargeId()),
        label: String(o.label ?? ""),
        amount: num(o.amount),
        bearer: o.bearer === "supplier" ? "supplier" : "customer",
        remarks: o.remarks ? String(o.remarks) : undefined,
      } as Charge;
    })
    .filter((c) => c.label);
}

export function sumCharges(charges: Charge[], bearer: Charge["bearer"]): number {
  return round2(charges.filter((c) => c.bearer === bearer).reduce((a, c) => a + num(c.amount), 0));
}

/** Only customer-borne charges are billed to the customer. */
export function customerChargeTotal(charges: Charge[]): number {
  return sumCharges(charges, "customer");
}

type Svc = Record<string, unknown>;
type BookingLike = {
  hotels?: Svc[] | null;
  flights?: Svc[] | null;
  others?: Svc[] | null;
  adjustments?: Record<string, unknown>[] | null;
};

const SERVICE_KEYS = ["hotels", "flights", "others"] as const;
const KIND_OF: Record<string, string> = { hotels: "hotel", flights: "flight", others: "other" };

/**
 * Rebuilds adjustments from the customer-borne charges on every service.
 * Manually added adjustments (those without a `ref`) are left untouched.
 */
export function rebuildAdjustments(booking: BookingLike): Record<string, unknown>[] {
  const manual = (booking.adjustments ?? []).filter(
    (a) => !String((a as Record<string, unknown>).ref ?? "").startsWith("charge:"),
  );

  const derived: Record<string, unknown>[] = [];
  for (const key of SERVICE_KEYS) {
    (booking[key] ?? []).forEach((svc, i) => {
      const rowId = `${KIND_OF[key]}:${i}`;
      for (const c of readCharges(svc)) {
        if (c.bearer !== "customer" || !c.amount) continue;
        derived.push({
          ref: `charge:${rowId}:${c.id}`,
          label: c.label,
          amount: round2(c.amount),
          remarks: c.remarks ?? null,
        });
      }
    });
  }

  return [...manual, ...derived];
}

/** Folds supplier-borne charges into the service's other_charges. */
export function applySupplierCharges(svc: Svc): Svc {
  const charges = readCharges(svc);
  const supplierExtra = sumCharges(charges, "supplier");
  const manualOther = num(svc.other_charges_manual);
  return { ...svc, other_charges: round2(manualOther + supplierExtra) };
}
