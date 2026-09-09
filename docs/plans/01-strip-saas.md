# How to disable then delete lms-front commerce

This is PR-01 in `docs/plans/boteducation-program.md`. Run it after PR-04 and PR-05. The school happy path must work first. Do not delete half the repo on day one.

## Goal

BotEducation is one school per deploy. No billing, no marketplace, no platform payouts. Operators must still boot Next.js and log in after each step. Disable routes and env first. Delete modules only when nothing in the happy path imports them.

## Why this order

`npm run typecheck` currently passes with Stripe, Lemon Squeezy, Solana, Binance, PayPal, and the platform dashboard in the tree. A mass delete will fail the build. The README documents `lvh.me` tenant hosts and seeded paid-plan tenants. Keep one default tenant until a later single-school simplification.

## Files to touch

Disable first (keep files, stop linking and env).

- `app/[locale]/platform/**`. Platform billing, tenants, payouts, plans.
- `app/[locale]/dashboard/admin/{plans,products,payouts,revenue,transactions,subscriptions,payment-requests}/**`
- `app/[locale]/dashboard/teacher/revenue/**`
- `app/[locale]/dashboard/student/{payments,billing,store}/**`
- `app/[locale]/(public)/products/**`
- Payment API routes under `app/api/` that mention stripe, paypal, lemonsqueezy, solana, binance, billing.
- Nav entries in student, teacher, and admin shells that point at those pages.

Delete only after grep shows zero remaining imports (second commit or stacked child).

- `lib/` payment provider modules and Stripe Connect helpers.
- Coin store, leagues, XP surfaces that the student shell no longer links (`lib` gamification, weekly leagues migrations stay in history).
- Landing-page builder (`lib/puck`, `mcp-server/src/tools/landing-pages.ts`) after MCP clients stop calling those tools.
- i18n may stay. English-first is enough. Do not spend this PR rewriting `next-intl`.

Keep.

- Auth, tenants table (one row is the school), `tenant_users`, RLS helpers `is_staff_of` / `is_admin_of`.
- Courses, lessons, exercises, exams, enrollments.
- `mcp-server/` minus landing-page tools.
- `mcp_api_tokens` and `mcp_audit_log`.

## Schema changes

None in the disable step. Do not drop `subscriptions`, `transactions`, or Stripe columns while app code still types them.

After the delete step, a follow-up migration may drop unused tables. That is optional and must have its own PR. Empty tables with RLS are cheaper than a failed reset.

## Staged sequence

1. Hide nav links and redirect commerce URLs to `/dashboard`. Prove login, course home, and MCP token page still load.
2. Make payment env vars unused. Document them in `.env.example` as unused. Do not require `STRIPE_SECRET_KEY` to boot.
3. Delete page files and provider modules. Run `npm run typecheck` and `npm run lint` after every package of deletes.
4. Leave Postgres commerce tables until a dedicated schema-drop PR.

## Acceptance checks

- `grep -R "STRIPE_SECRET_KEY" app components lib` has no remaining runtime reads, or each read is behind a dead branch that the boot path never hits.
- Student can open `/dashboard/student` and a course. No store or checkout in that shell.
- Admin can open users and the MCP token page. No payouts page in that shell.
- `npm run typecheck` exits 0.
- `npm run db:reset` still applies. Seed may still insert products. That is allowed until the schema-drop PR.

## Risks

- Enrollment currently has a check that a row is tied to a product or a subscription (`valid_enrollment` in `supabase/migrations/20260126190500_lms_complete.sql`). Free roster enrollments may already use a later migration. Confirm before deleting product rows from seed.
- Multi-tenant subdomain code is how local login works (`lvh.me`). Do not rip `tenants` in this PR. One school per deploy still uses one tenant row.
- MCP landing-page tools will break Grok if they remain advertised after files are deleted. Remove them from `mcp-server/index.ts` in the same delete commit.
- Seeded `creator@codeacademy.com` on a second subdomain is leftover SaaS. Leave it until the single-school PR. Do not make it a blocker for disable.
