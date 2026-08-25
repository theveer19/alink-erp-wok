-- =====================================================================
--  Travel Booking ERP — Phase 1: Multi-tenant Postgres schema (Supabase)
--  Ported from the FastAPI + MongoDB demo. Option 1 architecture:
--  FastAPI backend keeps its logic; MongoDB is replaced by Postgres.
--
--  Design notes:
--   * Each travel agency = one row in `tenants`. Every business table
--     carries tenant_id and is protected by Row Level Security (RLS).
--   * Booking sub-collections (hotels/flights/others/adjustments/
--     passengers/timeline) are stored as JSONB so the existing Python
--     financial logic (compute_financials / recompute_service /
--     redact_for_role) works with minimal change.
--   * Auth stays app-managed (bcrypt password_hash + your JWT), NOT
--     Supabase Auth — so auth.py / security.py are reused as-is.
--   * users.email is globally unique => login resolves tenant from email.
--
--  How the backend enforces tenancy:
--   The FastAPI backend connects with a dedicated app role and, at the
--   start of each request transaction, runs:
--       SET LOCAL app.current_tenant = '<tenant-uuid-of-logged-in-user>';
--   RLS policies below read that GUC. If it is unset, zero rows are
--   returned (fail-closed). Platform/super-admin operations use a
--   service connection that bypasses RLS.
--
--  Run this once in the Supabase SQL editor (or via migration tooling).
-- =====================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- Helper: current tenant from session GUC (fail-closed)
-- ---------------------------------------------------------------------
create or replace function app_current_tenant()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_tenant', true), '')::uuid
$$;

-- Reusable updated_at trigger
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =====================================================================
--  TENANTS  (one per travel agency)
-- =====================================================================
create table tenants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique,                       -- optional subdomain / short code
  plan          text not null default 'trial',     -- trial | basic | pro
  status        text not null default 'active',    -- active | suspended | cancelled
  trial_ends_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_tenants_updated before update on tenants
  for each row execute function set_updated_at();

-- =====================================================================
--  USERS  (staff accounts; app-managed auth)
--  email is globally unique so login can resolve the tenant.
-- =====================================================================
create table users (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  email          text not null unique,
  password_hash  text not null,
  name           text not null default '',
  role           text not null default 'sales'
                 check (role in ('super_admin','admin','sales','operations','accounts')),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_users_tenant on users(tenant_id);
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();

-- =====================================================================
--  COMPANY SETTINGS  (one row per tenant — was a Mongo singleton)
-- =====================================================================
create table company_settings (
  tenant_id          uuid primary key references tenants(id) on delete cascade,
  name               text,
  logo_url           text,
  address            text,
  phone              text,
  email              text,
  website            text,
  gst_number         text,
  bank_details       text,
  booking_prefix     text default 'MT',
  invoice_prefix     text default 'INV',
  email_signature    text,
  terms              text,
  flight_fee_presets jsonb not null default '[]'::jsonb,
  updated_at         timestamptz not null default now()
);
create trigger trg_company_updated before update on company_settings
  for each row execute function set_updated_at();

-- =====================================================================
--  COUNTERS  (per-tenant sequences: booking / invoice / svc)
--  Replaces Mongo counters collection. Atomic via upsert + returning.
-- =====================================================================
create table counters (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  name       text not null,            -- 'booking' | 'invoice' | 'svc'
  seq        bigint not null default 0,
  primary key (tenant_id, name)
);

-- Atomic next-sequence for a tenant. Call: select next_seq(:tenant, 'booking');
create or replace function next_seq(p_tenant uuid, p_name text)
returns bigint
language plpgsql
as $$
declare
  v bigint;
begin
  insert into counters(tenant_id, name, seq)
  values (p_tenant, p_name, 1)
  on conflict (tenant_id, name)
  do update set seq = counters.seq + 1
  returning seq into v;
  return v;
end;
$$;

-- =====================================================================
--  CUSTOMERS
-- =====================================================================
create table customers (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  name                  text not null,
  company               text,
  contact_person        text,
  mobile                text,
  email                 text,
  address               text,
  gst_number            text,
  hotel_service_charge  numeric(12,2),
  flight_service_charge numeric(12,2),
  created_by            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_customers_tenant on customers(tenant_id);
create index idx_customers_search on customers using gin
  (to_tsvector('simple', coalesce(name,'')||' '||coalesce(company,'')||' '||coalesce(mobile,'')||' '||coalesce(email,'')));
create trigger trg_customers_updated before update on customers
  for each row execute function set_updated_at();

-- =====================================================================
--  SUPPLIERS
-- =====================================================================
create table suppliers (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete cascade,
  name                   text not null,
  company                text,
  supplier_type          text default 'Hotel',   -- Hotel|Flight|DMC|Transport|Sightseeing|Other
  contact_person         text,
  mobile                 text,
  email                  text,
  address                text,
  gst_number             text,
  payment_terms          text,
  default_rate           numeric(12,2),
  default_service_charge numeric(12,2),
  bank_details           text,
  remarks                text,
  active                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index idx_suppliers_tenant on suppliers(tenant_id);
create index idx_suppliers_type on suppliers(tenant_id, supplier_type);
create trigger trg_suppliers_updated before update on suppliers
  for each row execute function set_updated_at();

-- =====================================================================
--  BOOKINGS
--  Sub-collections kept as JSONB (hotels/flights/others/adjustments/
--  passengers/timeline) so existing Python financial logic is reused.
-- =====================================================================
create table bookings (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references tenants(id) on delete cascade,
  booking_number           text not null,
  customer_id              uuid references customers(id) on delete set null,
  customer_snapshot        jsonb not null default '{}'::jsonb,
  travel_start_date        text,
  travel_end_date          text,
  destination              text,
  num_nights               int default 0,
  num_adults               int default 0,
  num_children             int default 0,
  num_rooms                int default 0,
  num_travellers           int default 0,
  lead_source              text,
  booked_by                text,
  booker_mobile            text,
  booker_email             text,
  passengers               jsonb not null default '[]'::jsonb,
  adjustments              jsonb not null default '[]'::jsonb,
  sales_executive_id       uuid,
  sales_executive_name     text,
  operations_executive_id  uuid,
  operations_executive_name text,
  special_requirements     text,
  internal_remarks         text,
  status                   text not null default 'Booking Requested',
  payment_status           text not null default 'Unpaid',
  hotels                   jsonb not null default '[]'::jsonb,
  flights                  jsonb not null default '[]'::jsonb,
  others                   jsonb not null default '[]'::jsonb,
  service_charge_total     numeric(12,2) default 0,
  rates_locked             boolean not null default false,
  voucher_generated        boolean not null default false,
  timeline                 jsonb not null default '[]'::jsonb,
  invoice_id               uuid,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (tenant_id, booking_number)
);
create index idx_bookings_tenant on bookings(tenant_id);
create index idx_bookings_status on bookings(tenant_id, status);
create index idx_bookings_sales on bookings(tenant_id, sales_executive_id);
create index idx_bookings_customer on bookings(tenant_id, customer_id);
create index idx_bookings_created on bookings(tenant_id, created_at desc);
create trigger trg_bookings_updated before update on bookings
  for each row execute function set_updated_at();

-- =====================================================================
--  INVOICES  (items/customer/passengers as JSONB)
-- =====================================================================
create table invoices (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  invoice_number       text not null,
  booking_id           uuid references bookings(id) on delete set null,
  booking_number       text,
  customer             jsonb not null default '{}'::jsonb,
  passengers           jsonb not null default '[]'::jsonb,
  items                jsonb not null default '[]'::jsonb,
  subtotal             numeric(12,2) not null default 0,
  discount             numeric(12,2) not null default 0,
  tax_rate             numeric(6,2)  not null default 18,
  gst_basis            text not null default 'total',   -- 'total' | 'service_charge'
  service_charge_total numeric(12,2) not null default 0,
  tax_amount           numeric(12,2) not null default 0,
  grand_total          numeric(12,2) not null default 0,
  amount_received      numeric(12,2) not null default 0,
  balance_due          numeric(12,2) not null default 0,
  status               text not null default 'Unpaid',  -- Unpaid|Partially Paid|Paid
  notes                text default '',
  terms                text,
  invoice_date         timestamptz not null default now(),
  created_by           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (tenant_id, invoice_number),
  unique (tenant_id, booking_id)         -- one invoice per booking
);
create index idx_invoices_tenant on invoices(tenant_id);
create index idx_invoices_status on invoices(tenant_id, status);
create trigger trg_invoices_updated before update on invoices
  for each row execute function set_updated_at();

-- =====================================================================
--  PAYMENTS  (customer receipts + supplier payouts)
-- =====================================================================
create table payments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  type         text not null,                 -- 'customer' | 'supplier'
  invoice_id   uuid references invoices(id) on delete set null,
  booking_id   uuid references bookings(id) on delete set null,
  supplier_id  uuid references suppliers(id) on delete set null,
  amount       numeric(12,2) not null,
  mode         text,                          -- Bank Transfer|UPI|Cash|Card|Cheque
  reference    text,
  remarks      text,
  date         timestamptz,
  recorded_by  text,
  created_at   timestamptz not null default now()
);
create index idx_payments_tenant on payments(tenant_id);
create index idx_payments_type on payments(tenant_id, type);
create index idx_payments_booking on payments(tenant_id, booking_id);

-- =====================================================================
--  DOCUMENTS  (booking / invoice attachments + generated PDFs)
--  Mongo stored base64 in the doc. Here we store bytea. For production
--  you may switch `data` to a Supabase Storage object path instead.
-- =====================================================================
create table documents (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  booking_id   uuid references bookings(id) on delete cascade,
  invoice_id   uuid references invoices(id) on delete cascade,
  filename     text not null,
  content_type text,
  note         text,
  data         bytea,                         -- or storage_path text (see note)
  uploaded_by  text,
  created_at   timestamptz not null default now()
);
create index idx_documents_tenant on documents(tenant_id);
create index idx_documents_booking on documents(tenant_id, booking_id);

-- =====================================================================
--  NOTIFICATIONS  (role-targeted; read_by tracks who has read)
-- =====================================================================
create table notifications (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  roles          text[] not null default '{}',
  message        text not null,
  booking_id     uuid references bookings(id) on delete cascade,
  booking_number text,
  read_by        text[] not null default '{}',
  created_at     timestamptz not null default now()
);
create index idx_notifications_tenant on notifications(tenant_id, created_at desc);

-- =====================================================================
--  ACTIVITY LOGS + EMAIL LOGS  (audit trails)
-- =====================================================================
create table activity_logs (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  booking_id uuid references bookings(id) on delete cascade,
  "user"     text,
  team       text,
  action     text,
  timestamp  timestamptz not null default now()
);
create index idx_activity_tenant on activity_logs(tenant_id, timestamp desc);

create table email_logs (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  booking_id uuid references bookings(id) on delete cascade,
  to_email   text,
  subject    text,
  kind       text,
  status     text,
  sent_at    timestamptz not null default now()
);
create index idx_email_logs_tenant on email_logs(tenant_id, sent_at desc);

-- =====================================================================
--  AUTH-FLOW TABLES  (pre-authentication; NOT tenant-scoped by RLS)
-- =====================================================================
create table password_reset_tokens (
  token      text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_prt_expires on password_reset_tokens(expires_at);

create table login_attempts (
  identifier   text primary key,        -- "<ip>:<email>"
  count        int not null default 0,
  locked_until timestamptz
);

-- =====================================================================
--  ROW LEVEL SECURITY
--  Enable on every tenant-scoped table; policy = row's tenant_id must
--  equal the session tenant GUC. Backend sets it per request.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'tenants','users','company_settings','counters','customers','suppliers',
    'bookings','invoices','payments','documents','notifications',
    'activity_logs','email_logs'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
  end loop;
end$$;

-- tenants: a user may see only their own tenant row
create policy tenant_self on tenants
  using (id = app_current_tenant())
  with check (id = app_current_tenant());

-- generic tenant_id policy for the rest
do $$
declare t text;
begin
  foreach t in array array[
    'users','company_settings','counters','customers','suppliers',
    'bookings','invoices','payments','documents','notifications',
    'activity_logs','email_logs'
  ]
  loop
    execute format($f$
      create policy tenant_isolation on %I
        using (tenant_id = app_current_tenant())
        with check (tenant_id = app_current_tenant());
    $f$, t);
  end loop;
end$$;

-- =====================================================================
--  DATABASE ROLE FOR THE FASTAPI BACKEND
--  Create a login role that is subject to RLS (does NOT bypass it).
--  Set its password, then use it in the backend connection string.
--  (Supabase: run once; replace the password.)
-- =====================================================================
-- create role erp_app login password 'CHANGE_ME_STRONG';
-- grant usage on schema public to erp_app;
-- grant select, insert, update, delete on all tables in schema public to erp_app;
-- grant usage, select on all sequences in schema public to erp_app;
-- grant execute on all functions in schema public to erp_app;
-- alter default privileges in schema public
--   grant select, insert, update, delete on tables to erp_app;

-- =====================================================================
--  END OF PHASE 1 SCHEMA
-- =====================================================================
