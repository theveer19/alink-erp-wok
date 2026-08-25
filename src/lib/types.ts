// Core row shapes (hand-written starter). In Phase C we can replace these
// with types generated from Supabase: `supabase gen types typescript`.

export type Role = "super_admin" | "admin" | "sales" | "operations" | "accounts";

export interface Tenant {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  created_at: string;
}

export interface Profile {
  id: string;          // = auth.users.id
  tenant_id: string;
  email: string | null;
  name: string;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  company: string | null;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  gst_number: string | null;
  hotel_service_charge: number | null;
  flight_service_charge: number | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  supplier_type: string;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  payment_terms: string | null;
  active: boolean;
  created_at: string;
}

// extended supplier fields (full form)
export interface SupplierFull extends Supplier {
  company: string | null;
  address: string | null;
  gst_number: string | null;
  default_rate: number | null;
  default_service_charge: number | null;
  bank_details: string | null;
  remarks: string | null;
}

export interface BookingFinancialsT {
  hotel_sales: number;
  flight_sales: number;
  other_sales: number;
  total_sales: number;
  total_supplier_cost?: number;
  gross_profit?: number;
  margin?: number;
}

export interface Booking {
  id: string;
  tenant_id: string;
  booking_number: string;
  customer_id: string | null;
  customer_snapshot: {
    name?: string;
    company?: string;
    mobile?: string;
    email?: string;
    gst_number?: string;
    address?: string;
  } | null;
  travel_start_date: string | null;
  travel_end_date: string | null;
  destination: string | null;
  num_nights: number;
  num_adults: number;
  num_children: number;
  num_rooms: number;
  num_travellers: number;
  lead_source: string | null;
  booked_by: string | null;
  booker_mobile: string | null;
  booker_email: string | null;
  passengers: Record<string, unknown>[];
  adjustments: Record<string, unknown>[];
  sales_executive_id: string | null;
  sales_executive_name: string | null;
  special_requirements: string | null;
  internal_remarks: string | null;
  status: string;
  payment_status: string;
  hotels: Record<string, unknown>[];
  flights: Record<string, unknown>[];
  others: Record<string, unknown>[];
  service_charge_total: number | null;
  rates_locked: boolean;
  timeline: { at: string; by: string; action: string }[];
  invoice_id: string | null;
  invoice_number?: string | null;
  created_at: string;
  financials?: BookingFinancialsT;
}

export interface InvoiceItemT {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  booking_id: string | null;
  booking_number: string | null;
  customer: { name?: string; company?: string; address?: string; mobile?: string; email?: string; gst_number?: string } | null;
  items: InvoiceItemT[];
  subtotal: number;
  discount: number;
  tax_rate: number;
  gst_basis: "total" | "service_charge";
  service_charge_total: number;
  tax_amount: number;
  grand_total: number;
  amount_received: number;
  balance_due: number;
  status: "Unpaid" | "Partially Paid" | "Paid";
  notes: string | null;
  terms: string | null;
  invoice_date: string;
  created_by: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  type: "customer" | "supplier";
  booking_id: string | null;
  invoice_id: string | null;
  invoice_number?: string | null;
  supplier_id: string | null;
  amount: number;
  mode: string | null;
  reference: string | null;
  remarks: string | null;
  date: string | null;
  recorded_by: string | null;
  created_at: string;
}