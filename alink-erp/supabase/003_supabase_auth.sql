-- =====================================================================
--  Phase A — switch identity/RLS to Supabase Auth
--  Run AFTER 001_init_schema.sql.  (002_roles_and_rls.sql is NOT needed
--  in the Supabase-Auth stack; the erp_app role can be ignored/dropped.)
--
--  What changes vs the FastAPI plan:
--   * Identity is now Supabase Auth (auth.users). We add a `profiles`
--     table linking each auth user to a tenant + role.
--   * RLS no longer uses a custom GUC. It uses auth.uid() via helper
--     functions, so supabase-js queries are automatically tenant-scoped.
--   * The custom-auth tables (users, login_attempts, password_reset_tokens)
--     and app_current_tenant() are dropped.
--   * All business tables (customers, suppliers, bookings, invoices, …)
--     stay exactly as created in 001.
-- =====================================================================

-- 1) Remove the old GUC-based policies + custom-auth artifacts ----------
do $$
declare t text;
begin
  foreach t in array array[
    'users','company_settings','counters','customers','suppliers',
    'bookings','invoices','payments','documents','notifications',
    'activity_logs','email_logs'
  ]
  loop
    execute format('drop policy if exists tenant_isolation on %I;', t);
  end loop;
end $$;
drop policy if exists tenant_self on tenants;

drop table if exists password_reset_tokens cascade;
drop table if exists login_attempts cascade;
drop table if exists users cascade;
drop function if exists app_current_tenant() cascade;

-- 2) Profiles: link Supabase auth users -> tenant + role ---------------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  email      text,
  name       text not null default '',
  role       text not null default 'sales'
             check (role in ('super_admin','admin','sales','operations','accounts')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_profiles_tenant on profiles(tenant_id);

-- 3) Auth helper functions (SECURITY DEFINER so they can read profiles
--    without tripping RLS / causing recursion) ---------------------------
create or replace function auth_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from profiles where id = auth.uid()
$$;

create or replace function auth_role()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- 4) Per-tenant sequence, tenant derived from the caller ---------------
create or replace function next_seq(p_name text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint; t uuid;
begin
  t := auth_tenant_id();
  if t is null then raise exception 'No tenant for current user'; end if;
  insert into counters(tenant_id, name, seq) values (t, p_name, 1)
  on conflict (tenant_id, name) do update set seq = counters.seq + 1
  returning seq into v;
  return v;
end $$;

-- 5) RLS enable + tenant policies (auth-based) -------------------------
alter table profiles enable row level security;

-- profiles: a user sees profiles within their own tenant
create policy profiles_tenant on profiles
  for all using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- tenants: a user sees only their own tenant row
create policy tenant_self on tenants
  for all using (id = auth_tenant_id())
  with check (id = auth_tenant_id());

-- generic tenant policy for the business tables
do $$
declare t text;
begin
  foreach t in array array[
    'company_settings','counters','customers','suppliers',
    'bookings','invoices','payments','documents','notifications',
    'activity_logs','email_logs'
  ]
  loop
    execute format($f$
      create policy tenant_rw on %I
        for all using (tenant_id = auth_tenant_id())
        with check (tenant_id = auth_tenant_id());
    $f$, t);
  end loop;
end $$;

-- =====================================================================
--  MANUAL TEST SETUP (until Phase B onboarding UI exists)
--  1. Supabase Dashboard → Authentication → Users → Add user
--       email: admin@alink.com   password: Admin@123   (auto-confirm)
--     Copy the new user's UUID.
--  2. Create a tenant and the admin's profile (run below, fill the UUID):
--
--     insert into tenants (name, slug) values ('A Link Tours','alink')
--       returning id;
--     insert into profiles (id, tenant_id, email, name, role)
--       values ('<AUTH_USER_UUID>', '<TENANT_ID>',
--               'admin@alink.com', 'Admin', 'admin');
--
--  Then log in at /login with those credentials.
-- =====================================================================
