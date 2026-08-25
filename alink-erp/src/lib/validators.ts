import { z } from "zod";

// "" or null -> null ; otherwise a finite number
const numish = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().finite().nullable()
);

// optional free text -> null when blank
const optText = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().nullable()
);

// email, but allow blank -> null
const optEmail = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().email("Enter a valid email").nullable()
);

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  company: optText,
  contact_person: optText,
  mobile: optText,
  email: optEmail,
  address: optText,
  gst_number: optText,
  hotel_service_charge: numish,
  flight_service_charge: numish,
});

// same fields, all optional (partial update)
export const customerUpdateSchema = customerCreateSchema.partial();

export type CustomerInput = z.infer<typeof customerCreateSchema>;

// ============================ SUPPLIERS ============================

export const SUPPLIER_TYPES = ["Hotel", "Flight", "DMC", "Transport", "Sightseeing", "Other"] as const;

const boolish = z.preprocess(
  (v) => (v === undefined || v === null ? true : v),
  z.boolean()
);

export const supplierCreateSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required"),
  company: optText,
  supplier_type: z.enum(SUPPLIER_TYPES).default("Hotel"),
  contact_person: optText,
  mobile: optText,
  email: optEmail,
  address: optText,
  gst_number: optText,
  payment_terms: optText,
  default_rate: numish,
  default_service_charge: numish,
  bank_details: optText,
  remarks: optText,
  active: boolish,
});

export const supplierUpdateSchema = supplierCreateSchema.partial();

export type SupplierInput = z.infer<typeof supplierCreateSchema>;

// ============================ BOOKINGS ============================

const intish = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : Math.trunc(Number(v))),
  z.number().int().nonnegative()
);

export const bookingCreateSchema = z
  .object({
    customer_id: z.string().uuid().optional().nullable(),
    customer: z
      .object({
        name: optText,
        company: optText,
        contact_person: optText,
        mobile: optText,
        email: optEmail,
        address: optText,
        gst_number: optText,
      })
      .partial()
      .default({}),
    travel_start_date: optText,
    travel_end_date: optText,
    destination: optText,
    num_nights: intish,
    num_adults: intish,
    num_children: intish,
    num_rooms: intish,
    num_travellers: intish,
    lead_source: optText,
    booked_by: optText,
    booker_mobile: optText,
    booker_email: optEmail,
    passengers: z.array(z.record(z.any())).default([]),
    special_requirements: optText,
    internal_remarks: optText,
    status: z.string().default("Booking Requested"),
  })
  .refine((d) => !!d.customer_id || !!(d.customer && d.customer.name), {
    message: "Select a customer or enter a new customer name",
    path: ["customer"],
  });

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

// ============================ INVOICES ============================

export const invoiceCreateSchema = z.object({
  booking_id: z.string().uuid(),
  discount: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().min(0).default(0)),
  tax_rate: z.preprocess((v) => (v === "" || v == null ? 18 : Number(v)), z.number().min(0).default(18)),
  gst_basis: z.enum(["total", "service_charge"]).default("total"),
  extra_items: z.array(z.object({ description: z.string().optional(), amount: z.coerce.number().optional() })).default([]),
  terms: optText,
});

export const invoiceUpdateSchema = z.object({ notes: optText, terms: optText }).partial();

// ============================ PAYMENTS ============================

export const paymentSchema = z.object({
  type: z.enum(["customer", "supplier"]),
  booking_id: z.string().uuid().optional().nullable(),
  invoice_id: z.string().uuid().optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  mode: optText,
  reference: optText,
  remarks: optText,
  date: optText,
});
