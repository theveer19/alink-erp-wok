# A Link Tours — Booking ERP (Next.js + Supabase)

Multi-tenant travel-agency booking ERP. **Phase A skeleton**: auth,
multi-tenant RLS, and the app shell are working. Business modules
(bookings, invoices, payments, reports) land in later phases.

## Stack
- Next.js 14 (App Router) + TypeScript
- Supabase (Postgres + Auth + Row Level Security)
- Tailwind CSS + shadcn/ui design tokens (ported from the approved demo)

## Setup

### 1. Database
In the Supabase SQL editor, run in order:
1. `supabase/001_init_schema.sql`  (business tables — already run if you did Phase 1)
2. `supabase/003_supabase_auth.sql` (profiles, auth-based RLS, per-tenant sequences)

> Skip `002_roles_and_rls.sql` from the earlier FastAPI plan — not used here.

### 2. Environment
Copy `.env.local.example` to `.env.local` and fill from
Supabase → Project Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never exposed to the browser)

### 3. Create a test tenant + admin
Follow the "MANUAL TEST SETUP" block at the bottom of
`supabase/003_supabase_auth.sql`.

### 4. Run
```bash
npm install
npm run dev
```
Open http://localhost:3000 → redirects to /login. Sign in with the admin
you created. You should land on /dashboard showing live counts (0 to start).

## What's here
- `src/lib/supabase/` — browser, server (RLS), and admin (service role) clients
- `middleware.ts` — session refresh + route protection
- `src/app/login` — Supabase Auth sign-in
- `src/app/(protected)/` — auth-guarded shell + dashboard placeholder
- `supabase/` — SQL migrations

## Keeping Supabase awake
Free-tier Supabase projects auto-pause after 7 days with no API activity.
`.github/workflows/supabase-keepalive.yml` pings the project's REST API
every 3 days so this never happens — it works independently of where (or
whether) the app is deployed.

One-time setup: in the GitHub repo, go to
Settings -> Secrets and variables -> Actions and add two repository
secrets, using the values from `.env.local`:
- `SUPABASE_URL` = `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY` = `NEXT_PUBLIC_SUPABASE_ANON_KEY`

You can trigger it manually anytime from the Actions tab ("Run workflow")
to confirm it's working.

Once this app is deployed on Vercel, `vercel.json` + `src/app/api/cron/keep-alive/route.ts`
give a second, app-level keep-alive that Vercel Cron can call directly.

## Roadmap
- **Phase B** — tenant onboarding (agency signup → tenant + admin profile)
- **Phase C** — modules in TS: customers/suppliers → bookings/services →
  invoices/payments → reports (ports the demo logic + financial rules)
- **Phase D** — server-side PDF (voucher/invoice) + email
- **Phase E** — Razorpay subscription billing + deploy (Vercel)
