# Monetization leftovers

**Status:** retired for this self-hosted school fork.

BotEducation is one school per deploy. Teachers create courses without a Free cap. Students who belong to the school enroll from Browse without buying a platform plan or a school-sold subscription. Keep `entitlements` and `enrollments`. Do not reintroduce course caps.

## What the product does now

- Course access is `entitlements`. Learning progress is `enrollments`.
- Membership enroll is `self_enroll_school_course(_course_id integer)`.
- Dashboard store, billing, payouts, products, plans, and `/platform` redirect away (`COMMERCE_GONE_PATHS` in `next.config.ts`).
- Public marketing routes (`/pricing`, `/courses`, `/creators`, `/checkout`, `/platform-pricing`) are retired. `proxy.ts` sends anonymous visitors to login.

## What not to rebuild

Do not wire any of these back into the dashboard:

- `BillingOverview` (deleted)
- `PlanChangeDialog` (deleted)
- `FeatureGate` / `usePlanFeatures()` (deleted)
- `/pricing` CTAs
- `UpgradeNudge` as a live upgrade path (the remaining compact nudge on certificate design does not link to `/pricing`)

## Leftover tables and code

These still exist so existing access rows keep working. They are not a live billing product:

- `products`, `plans`, `plan_courses`, `transactions`, `subscriptions`, `payment_requests`, `entitlements`
- `platform_plans`, `platform_subscriptions`, `platform_payment_requests`
- `lib/billing/*`, `app/actions/platform/*`, `app/actions/admin/billing.ts`
- `get_plan_features(_tenant_id)` RPC. A few leftover callers remain (landing-page create cap, checkpoint AI monthly quota). Those are not dashboard upgrade CTAs.

If you are reading this file to "open Billing" or "upgrade the school plan", stop. That UI is gone.
