# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BotEducation is a self-hosted school LMS built with Next.js 16 (App Router, React 19) and Supabase. One school per deploy. Grok professors connect over MCP at `/api/mcp`. Local login still uses `lvh.me` tenant subdomains. The platform uses **RLS for data security** — database queries go directly from components, not through server actions.

**Stack:** Next.js 16.1.5 · Supabase (PostgreSQL 15, Auth, Storage) · Shadcn UI (base-mira) · Tailwind CSS v4 · TypeScript strict · Grok professors over MCP · next-intl (en/es)

Stripe Connect is leftover and disabled in this fork. Commerce routes redirect or return 410. Homework tables are live. Professor PAT auth is `lib/mcp/pat-proxy.ts`.

## Commands

```bash
npm run dev              # Dev server at http://localhost:3000
npm run build            # Production build (TypeScript + lint check)
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test:unit        # Vitest unit tests
npx vitest run -t "name" # Single unit test

supabase db push                # Apply local migrations to cloud
supabase migration new <name>   # Create migration file
npm run db:reset                # Reset local DB (migrations + seed)
npm run db:types                # Regenerate lib/database.types.ts from linked project

npx playwright test              # Run all E2E tests
npx playwright test --ui         # Interactive test runner
npx playwright test -g "name"    # Run single test
```

`/web-design-guidelines <path>` skill audits UI for accessibility + best practices.

Branches: `<type>/<slug>-<issueNumber>` (e.g. `fix/binance-settings-category-479`).

Cloud Agents use `.cursor/environment.json` → `scripts/cloud-agent-install.sh` then `scripts/cloud-agent-start.sh` (nested Docker, local Supabase, Next on `:3000`). Open `http://lvh.me:3000`, not localhost. Seeded login: `student@e2etest.com` / `password123`.


## Architecture

### Multi-Tenancy

Every request goes through `proxy.ts` (the single middleware file — **not** `middleware.ts`), which:
1. Extracts tenant slug from subdomain (`school.lmsplatform.com` → `"school"`)
2. Resolves tenant ID from `tenants` table
3. Injects `x-tenant-id` header into the response
4. Checks `tenant_users` membership; redirects non-members to `/join-school`
5. Enforces role-based route guards (`/dashboard/student`, `/dashboard/teacher`, `/dashboard/admin`)

In development, pass `x-tenant-slug` header to simulate a subdomain.

```typescript
import { getCurrentTenantId } from '@/lib/supabase/tenant'
const tenantId = await getCurrentTenantId() // reads x-tenant-id header
```

Default tenant ID (single-tenant fallback): `00000000-0000-0000-0000-000000000001`

### JWT Claims

`custom_access_token_hook()` injects into every JWT: `user_role` (global), `tenant_role` (`student`/`teacher`/`admin` in current tenant), `tenant_id`, `is_super_admin`.

```typescript
import { getUserRole } from '@/lib/supabase/get-user-role'
const role = await getUserRole()  // tenant_users row is authoritative; falls back to JWT tenant_role/user_role only if no active membership
```

After a tenant switch, **always call `supabase.auth.refreshSession()`** to get updated claims.

### Database Query Pattern

RLS is enabled on all tenant-scoped tables, but **filter by `tenant_id` explicitly anyway** — clarity and performance, not just security:

```typescript
const supabase = await createClient()       // @/lib/supabase/server
const tenantId = await getCurrentTenantId()
const { data } = await supabase.from('courses').select('*').eq('tenant_id', tenantId)
```

**Client imports:** server components → `@/lib/supabase/server` · client components → `@/lib/supabase/client` · admin/bypass-RLS → `createAdminClient()` from `@/lib/supabase/admin`.

When using `createAdminClient()` in server actions, manually validate tenant ownership before writes:
```typescript
const { data: resource } = await adminClient.from('products').select('tenant_id').eq('product_id', id).single()
if (resource.tenant_id !== tenantId) throw new Error('Access denied')
```

### Server Actions vs Direct Queries

Use **direct RLS queries** for all reads. Use **server actions** (in `app/actions/`: `admin/`, `teacher/`, `join-school.ts`, `onboarding.ts`) only for multi-step mutations, service-role operations, or external API calls.

### Course access

Access lives in `entitlements` (`user_id`, `course_id`, `tenant_id`, `source_type`, `source_id`, `status`, `expires_at`). `enrollments` is a learning-progress record only (`user_id`, `course_id`, `status`, `tenant_id`, `enrollment_date`). Students who belong to the school self-enroll from `/dashboard/student/browse` via `self_enroll_school_course` (or the membership RPC PR-02 shipped). Keep those tables. Do not reintroduce course caps.

Student storefronts, school billing dashboards, and `/platform` are retired (`COMMERCE_GONE_PATHS` in `next.config.ts`, `isRetiredMarketingPath` in `proxy.ts`). Leftover Stripe and `platform_plans` code may still exist under `lib/billing/` and `app/actions/platform/`. It is not a live product surface. Do not wire `UpgradeNudge`, `FeatureGate`, or `/pricing` CTAs back into the dashboard.

**Key invariants that still hold for leftover commerce tables:**
- Transaction `status`: `pending`, `successful`, `failed`, `archived`, `canceled`, `refunded`
- `subscriptions.cancel_at_period_end` is the ONLY signal that a cancel is scheduled
- `enroll_user()` RPC loops through ALL courses for a product via `product_courses` and writes to `entitlements`
- `transactions` is server-write-only. `authenticated` has no INSERT grant
- `transactions` has **no `created_at`** — it is `transaction_date`

### Routing & i18n

All routes live under `app/[locale]/` (`[locale]` is always `/en/` or `/es/`). Public routes (no auth): `/auth/*`, `/join-school`, `/verify`, `/oauth/consent`. Anonymous `/` and retired marketing paths (`/pricing`, `/courses`, `/creators`, `/checkout`, `/platform`, `/platform-pricing`) go to login or the role dashboard. Role routing after login: `/dashboard/student` · `/dashboard/teacher` · `/dashboard/admin`. There is no live `/platform` operator console, so `proxy.ts` does not call `checkSuperAdmin()`.

### Database Schema Essentials

116 tables. Key groups: multi-tenancy (`tenants`, `tenant_users`, `tenant_settings`, `super_admins`) · users (`profiles` — global, no tenant_id) · content (`courses`, `lessons`, `exercises`, `exams`, `exam_questions`) · progress (`enrollments` — progress only, `lesson_completions`, `exam_submissions`) · access (`entitlements` — course-access source of truth; leftover `products`, `plans`, `transactions`, `subscriptions`, `payment_requests`) · leftover platform billing tables (`platform_plans`, `platform_subscriptions`, `platform_payment_requests`) · gamification · certificates · notifications.

`profiles` and `gamification_levels` are global (no `tenant_id`).

**Key RPCs:**
```typescript
supabase.rpc('enroll_user', { _user_id, _product_id })
supabase.rpc('self_enroll_school_course', { _course_id }) // membership enroll, no subscription
supabase.rpc('has_course_access', { _user_id, _course_id })  // access check; _course_id is integer — cast ::int from SQL
supabase.rpc('award_xp', { _user_id, _action_type, _xp_amount, _reference_id, _reference_type })  // overload adds _tenant_id
supabase.rpc('create_exam_submission', { p_student_id, p_exam_id, p_answers })
supabase.rpc('save_exam_feedback', { p_submission_id, p_exam_id, p_student_id, p_answers, p_overall_feedback, p_score, p_question_feedback, p_ai_model, p_processing_time_ms })
```

`get_plan_features(_tenant_id)` still exists as a leftover RPC. Do not treat it as a live product gate for course create or Browse enroll.

### Plan leftovers (not live product)

Course and student caps were dropped. Do not reintroduce `enforce_course_plan_limit`, `LM001`, or Free upgrade screens. `lib/plans/server.ts` still has `hasPlanFeature` / `requirePlanFeature` / `getCertificateTier` for leftover teacher screens. Do not add new dashboard gates or `usePlanFeatures()` / `<FeatureGate>` (those files are deleted).

## MCP Server

`mcp-server/` exposes LMS course-management tools/resources/prompts/widgets to AI agents, built on **mcp-use** (not raw `@modelcontextprotocol/sdk`). **Read the `mcp-apps-builder` skill before touching it.** Local sidecar: `cd mcp-server && PORT=3001 npm run dev` (port 3000 fights Next). `npm run mcp:build` from root. Professor PATs are minted to a user JWT by `lib/mcp/pat-proxy.ts` before they reach this server. OAuth JWT and session paths also work. Every query runs through a request-scoped, RLS-aware client using the caller's token (no service-role data access); role/tenant come from JWT claims, gated per-role in `src/tool-policy.ts`. In production, `app/api/mcp/[[...path]]/route.ts` fronts it at `https://<tenant>.<domain>/api/mcp`. Professor how-to: [`docs/MCP_SETUP.md`](docs/MCP_SETUP.md). Tool inventory lives in `mcp-server/src/tools/*.ts`, widgets in `mcp-server/resources/<name>/widget.tsx` — read those directly rather than relying on a list here, as they change frequently.

## Environment Variables

See `.env.example` for the full annotated list. Minimum to run locally:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # Bypasses RLS — admin ops only
NEXT_PUBLIC_PLATFORM_DOMAIN=       # e.g. lvh.me for local dev, lmsplatform.com in prod
```
`NEXT_PUBLIC_OPENAI_API_KEY` is exposed to the browser bundle (speech input) — never put a production key there.

## Testing

E2E tests in `tests/playwright/` — tenant isolation, auth security, enrollment, entitlements, gamification, i18n, teacher/admin CRUD. Read the directory rather than a list here; it changes often. Highest-priority: `tenant-isolation.spec.ts`, `auth-security.spec.ts`, `evaluations-security.spec.ts`.

Plan-gate E2E helpers are gone. Seeded tenants keep leftover `platform_plans` slugs. Do not recreate Free course caps in specs.

The Playwright config boots its own `webServer` (`next dev` locally on the `BASE_URL` port, reusing a server already listening; `next start` in CI). Use `lvh.me` (never `localhost`), and keep `--workers=1` locally or GoTrue rate-limits the sign-ins. Every spec lives in `tests/playwright/` — the only `testDir` — and every skip carries a reason (permanent ones link an issue); see `tests/README.md`. Unit tests: `npm run test:unit` (Vitest, `tests/unit/`).

Test accounts (from `supabase/seed.sql`, seeded by `supabase db reset`):
- `student@e2etest.com` / `password123` — student (Default School)
- `owner@e2etest.com` / `password123` — admin (Default School)
- `creator@codeacademy.com` / `password123` — **admin** (Code Academy, subdomain `code-academy.lvh.me:3000`)
- `alice@student.com` / `password123` — student (Code Academy)

Pre-commit checklist: `npm run build` · tenant filter on every query · tested with all relevant roles · loading + error states handled.

## Known Pitfalls

- **`product_courses` — never `.single()`**: a course can belong to multiple products.
- **`lesson_completions` uses `user_id`**, not `student_id`. Has **no `tenant_id`** — never filter by it.
- **`exercise_completions` has no `tenant_id`** — filter by `user_id` only.
- **`exams` has no `passing_score` or `allow_retake`** — use 70 as default threshold, assume retakes allowed.
- **`profiles` has no `email`** — get emails via `createAdminClient().auth.admin.getUserById()`.
- **`exam_submissions` order column** is `submission_date`, not `submitted_at`.
- **Transaction status** is `'successful'`, not `'succeeded'`.
- Exam child tables (`exam_questions`, `exam_answers`, `exam_question_scores`, `exam_scores`, `question_options`) have **no `tenant_id`** — filter by exam_id/submission_id only; adding `.eq('tenant_id', …)` errors the whole query. `exam_questions` also has **no `sequence`**.
- **`exercise_completions` uses `user_id`**, not `student_id`, and stores only `score` + `completed_at` — submissions/feedback live in `exercise_evaluations` and the `exercise_*_submissions` tables.
- **`subscriptions` uses `subscription_status`** (not `status`), `provider_subscription_id` (not `stripe_subscription_id`), and `created` (not `created_at`).
- **`plans` uses `plan_name` and `duration_in_days`** — there is no `name`, no `interval`, no `status`. Soft-deleted via `deleted_at`.
- **`transactions` has three unique indexes**, product-shaped and plan-shaped kept separate plus `(payment_provider, provider_charge_id)` for webhook idempotency — see `docs/DATABASE_SCHEMA.md`.
- **Creating test users via SQL** won't fire `handle_new_user()` — manually insert `profiles`, `user_roles`, `auth.identities`. Use `NULL` for `phone`, `''` for nullable strings.
- **`proxy.ts` is the only middleware** — do not create `middleware.ts` (conflict).
- **`createAdminClient()`** lives in `@/lib/supabase/admin`, NOT `@/lib/supabase/server`.
- **Button component** uses `@base-ui/react` — no `asChild` prop. Wrap `<Link>` around `<Button>` instead.
- **Stripe API v2025 types** need `any` casts for `Subscription`/`Invoice` objects.
- **`getUserRole()` checks `tenant_users` first** (authoritative), resolving the user via the `x-user-id` header — no extra `getUser()` call. It only falls back to `getSession()`-derived JWT claims (`tenant_role`/`user_role`) when there's no active membership row.
- **`isSuperAdmin()`** queries the `super_admins` table directly — does not trust JWT claims.
- **API routes** get tenant context via `proxy.ts` too — `x-tenant-id` is set for `/api/*` routes.
- **`enroll_user()` RPC** loops through ALL courses per product via `product_courses` (FOR loop).

## Security Notes

- **Sentry DSN comes from `NEXT_PUBLIC_SENTRY_DSN`, never a literal.** It was hardcoded in the three `Sentry.init` files until a third-party Vercel fork of this repo (deployed without Supabase env vars) filled our issue stream with its own crashes. Unset = `Sentry.init` no-ops.
- **Build-time env vars do NOT live in Dokploy.** `.github/workflows/deploy.yml` builds the image in GitHub Actions and pushes to `ghcr.io`; Dokploy only pulls it. Every `NEXT_PUBLIC_*` (plus `SENTRY_AUTH_TOKEN`) is a Docker `build-args` entry backed by an Actions variable/secret and a matching `ARG`/`ENV` pair in the Dockerfile's builder stage. Adding one to the Dokploy service environment is a silent no-op.
- **Test account passwords** (`password123`) are for local development only, seeded by `supabase db reset`. Never use in a deployed environment.

## Key Documentation

- `docs/DATABASE_SCHEMA.md` — complete schema with relationships
- `docs/AUTH.md` — auth flows
- `docs/AI_AGENT_GUIDE.md` — detailed patterns
- `docs/MONETIZATION.md` — leftover billing tables and why the storefront is gone
- `docs/COMMUNITY_SPACES.md` — community is deleted; lesson comments remain

## Design Context

**Canonical source: [`PRODUCT.md`](PRODUCT.md) (strategy) + [`DESIGN.md`](DESIGN.md) (visual system).** Read PRODUCT.md before any UI work — it carries the register, the user groups, the anti-references, and the five design principles. The summary below is a pointer, not the authority.

Users span independent creators/solo educators and multi-staff schools, across LATAM and English-speaking markets (en/es). Brand personality: **minimal, elegant, focused** — content over chrome, no visual noise.

- **Aesthetic:** clean, spacious, content-first; hierarchy via typography weight/size over color/ornament. References: Duolingo/Khan Academy, Teachable/Thinkific. Anti-references: cluttered enterprise dashboards, generic Bootstrap.
- **Theme:** light + dark, tenant theming overrides primary/accent via CSS custom properties. Default primary is **teal-cyan** `oklch(0.52 0.105 223.128)` light / `oklch(0.45 0.085 224.283)` dark — hue ~223, not 293. Nothing may depend on that hue holding; tenants override it.
- **Typography/icons:** Noto Sans (body), Geist Sans/Mono (UI/code); Tabler Icons + Lucide (outline style).
- **Motion:** subtle, via `motion` lib; respect `prefers-reduced-motion`; convey state changes, not decoration.
- **Principles:** content over chrome · obvious over clever · consistent structure across tenants (brand via color/logo, not layout) · WCAG AA by default · progressive disclosure (sheets/dialogs for detail).
- **Stack:** Shadcn UI (base-mira, `@base-ui/react` primitives) · Tailwind v4 with OKLCH tokens · `motion` + `tw-animate-css` · `next-themes` + `TenantCssVars` · `--radius: 0.625rem` base.

When reporting information to me, be extremely concise and sacrifice grammar for sake of concision.
