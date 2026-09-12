-- =====================================================================
--  004 — CLEAN RESET of all RLS policies + auth functions (Supabase Auth)
--  Safe: does NOT drop tables/data. It only removes ALL existing policies
--  on the business tables and recreates the correct auth-based ones, and
--  rebuilds the helper functions with proper permissions.
--
--  Run this ONCE in the Supabase SQL editor. Then logout+login in the app.
-- =====================================================================

-- 1) Drop EVERY policy on every business table (whatever their names) ---
do $$
declare
  r record;
  tbls text[] := array[
    'tenants','profiles','company_settings','counters','customers','suppliers',
    'bookings','invoices','payments','documents','notifications',
    'activity_logs','email_logs'
  ];
  t text;
begin
  foreach t in array tbls loop
    -- skip tables that don't exist
    if to_regclass('public.'||t) is null then continue; end if;
    for r in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I;', r.policyname, t);
    end loop;
  end loop;
end $$;

-- 2) Drop the old GUC helper if it still exists ------------------------
drop function if exists app_current_tenant() cascade;

-- 3) Rebuild the auth helper functions (SECURITY DEFINER + grants) -----
create or replace function auth_tenant_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function auth_role()
returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

grant execute on function auth_tenant_id() to authenticated, anon, service_role;
grant execute on function auth_role()      to authenticated, anon, service_role;

-- per-tenant sequence, tenant derived from the caller
drop function if exists next_seq(uuid, text);
create or replace function next_seq(p_name text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v bigint; t uuid;
begin
  t := auth_tenant_id();
  if t is null then raise exception 'No tenant for current user'; end if;
  insert into counters(tenant_id, name, seq) values (t, p_name, 1)
  on conflict (tenant_id, name) do update set seq = counters.seq + 1
  returning seq into v;
  return v;
end $$;
grant execute on function next_seq(text) to authenticated, service_role;

-- 4) Enable RLS + create ONE correct policy per table -----------------

-- profiles: user sees profiles in their own tenant
alter table profiles enable row level security;
create policy profiles_tenant on profiles
  for all using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- tenants: user sees only their own tenant row
alter table tenants enable row level security;
create policy tenant_self on tenants
  for all using (id = auth_tenant_id())
  with check (id = auth_tenant_id());

-- all business tables: tenant match
do $$
declare t text;
begin
  foreach t in array array[
    'company_settings','counters','customers','suppliers',
    'bookings','invoices','payments','documents','notifications',
    'activity_logs','email_logs'
  ]
  loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$
      create policy tenant_rw on public.%I
        for all using (tenant_id = auth_tenant_id())
        with check (tenant_id = auth_tenant_id());
    $f$, t);
  end loop;
end $$;

-- 5) Verify: should list exactly one tenant policy per table ----------
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
