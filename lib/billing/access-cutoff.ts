/**
 * Real access enforcement for over-limit tenants (issue #494) and the
 * notification ladder around it (issue #517).
 *
 * `has_course_access()` never considered a tenant's plan/billing state — a
 * tenant downgraded (or that simply outgrew its plan) kept full access to
 * every course indefinitely. This module is the single place that decides
 * and schedules `tenants.access_cutoff_at`, the timestamp
 * `has_course_access()` checks (see migration 20260724130000).
 *
 * Split mirrors `plan-limits.ts`: pure decision functions (unit-testable,
 * no DB) plus an impure reconciler that every plan-state transition calls —
 * the webhook-driven downgrade, both admin plan-change actions, the portal
 * change handler, and a daily cron sweep for organic growth over a limit
 * with no plan-change event. All of them can call `reconcileAccessCutoff`
 * freely; the decision function's null-check on `currentCutoffAt` makes
 * repeated calls idempotent (no double-scheduling, no duplicate emails).
 *
 * #550: those call sites were all *plan-change* events, and the cutoff email
 * asks for a *usage* action ("20 active courses exceed the Free plan's limit
 * of 15"). A school that did exactly what it was told — archived courses,
 * removed members — reconciled nothing and stayed locked out until the next
 * daily sweep, or indefinitely if nothing on the host calls `/api/cron/*`
 * (#513). Every action that can *reduce* usage now reconciles too, via
 * `reconcileAccessCutoffSafely`, and the admin billing page carries a manual
 * re-check so recovery never depends on a scheduler at all.
 *
 * #517: that idempotence was also the communication bug. Because
 * `decideAccessCutoffAction` returns `'schedule'` exactly once per cutoff,
 * the school got exactly one email, 14 days out, with no retry if it failed
 * and no word at all on the day access actually stopped. The ladder below
 * (`scheduled` → `reminder_7d` → `reminder_1d` → `enforced`) fixes that: the
 * daily sweep passes `notifyDueStages` and sends whichever rung is due,
 * de-duplicated against the `access_cutoff_notifications` ledger.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send'
import { type AccessCutoffStage } from '@/lib/email/templates/access-cutoff-warning'
import { type PlanLimitViolation } from '@/lib/billing/plan-limits'

export const ACCESS_CUTOFF_GRACE_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

export type { AccessCutoffStage }

export interface AccessCutoffDecision {
  action: 'schedule' | 'clear' | 'none'
  cutoffAt?: string
  /** #517: which notification rung was delivered on this call, if any. */
  notifiedStage?: AccessCutoffStage
  /** #517: a rung was due but nobody received it — the next sweep retries. */
  notifyFailed?: boolean
}

/**
 * Pure decision: should a cutoff be scheduled, cleared, or left alone.
 * `now` is injectable so callers/tests don't depend on wall-clock time.
 *
 * `limitsKnown: false` says the caller could not resolve the tenant's plan
 * limits at all (#550 §3). An empty `violations` list then means "we don't
 * know", not "they comply", and the difference matters in exactly one
 * direction: scheduling stays fail-open (nothing is enforced off limits we
 * never read), while an existing cutoff is left standing rather than cleared.
 *
 * The asymmetry is deliberate. A `platform_plans` lookup misses because a slug
 * was renamed or a row deleted — an operator error, not a signal about the
 * school. Clearing on that miss lifts live enforcement school-wide, and the
 * only ways back are buying a bigger plan or a super admin editing the row.
 * Preserving it costs nothing: the next sweep that *can* read the limits
 * clears the cutoff on its own if the school is genuinely compliant.
 */
export function decideAccessCutoffAction(input: {
  violations: PlanLimitViolation[]
  currentCutoffAt: string | null
  now: Date
  limitsKnown?: boolean
}): AccessCutoffDecision {
  const { violations, currentCutoffAt, now, limitsKnown = true } = input

  if (violations.length > 0 && !currentCutoffAt) {
    const cutoffAt = new Date(now.getTime() + ACCESS_CUTOFF_GRACE_DAYS * DAY_MS).toISOString()
    return { action: 'schedule', cutoffAt }
  }

  if (violations.length === 0 && currentCutoffAt && limitsKnown) {
    return { action: 'clear' }
  }

  return { action: 'none' }
}

/**
 * Pure decision: which rung of the notification ladder is due right now.
 *
 * Returns **at most one** stage — always the most urgent rung whose trigger
 * point has been reached and which the ledger has not yet recorded. Sending
 * two rungs in one sweep would put contradictory messages in the same inbox
 * ("you have 7 days" beside "access is now paused"), so a less urgent rung
 * that was never delivered is superseded rather than queued behind the
 * urgent one.
 *
 * That "most urgent unsent" rule is also the retry #517 asks for: a stage
 * whose sends all failed is never written to the ledger, so it is still
 * unsent — and still the most urgent reached rung — on the next daily sweep.
 *
 * Once the cutoff has passed only `enforced` can be due; a future-tense
 * warning delivered after the fact is worse than silence.
 */
export function dueCutoffNotificationStage(input: {
  cutoffAt: string
  sentStages: AccessCutoffStage[]
  now: Date
}): AccessCutoffStage | null {
  const { cutoffAt, sentStages, now } = input

  const msRemaining = new Date(cutoffAt).getTime() - now.getTime()
  if (Number.isNaN(msRemaining)) return null

  const sent = new Set(sentStages)

  // Most urgent first; the first unsent one wins.
  const reached: AccessCutoffStage[] = []
  if (msRemaining <= 0) {
    reached.push('enforced')
  } else {
    if (msRemaining <= DAY_MS) reached.push('reminder_1d')
    if (msRemaining <= 7 * DAY_MS) reached.push('reminder_7d')
    reached.push('scheduled')
  }

  return reached.find((stage) => !sent.has(stage)) ?? null
}

/**
 * Fetch a tenant's current plan/usage, decide, and apply.
 * Self-hosted leftover cleanup PR-01: never schedule or write cutoff.
 */
export async function reconcileAccessCutoff(
  _admin: SupabaseClient,
  _tenantId: string,
  _opts?: { sendEmailFn?: typeof sendEmail; now?: Date; notifyDueStages?: boolean }
): Promise<AccessCutoffDecision> {
  return { action: 'none' }
}

/**
 * `reconcileAccessCutoff` for callers whose own write has already succeeded
 * (#550): archiving a course, deleting one, removing a member.
 *
 * Those actions are the school doing exactly what the cutoff email asked, and
 * the reconcile is a follow-up benefit — never a precondition. Failing the
 * archive because a counting query timed out would punish compliance with the
 * one thing the school is trying to escape, so every failure is logged and
 * swallowed. The reconciler is idempotent, so the worst case is that the state
 * stays as it was until the next reconcile (manual re-check or daily sweep).
 *
 * `notifyDueStages` is deliberately left off: user-facing actions must not pay
 * email latency for a reminder the cron sends anyway.
 */
export async function reconcileAccessCutoffSafely(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  try {
    await reconcileAccessCutoff(admin, tenantId)
  } catch (err) {
    console.error('reconcileAccessCutoffSafely: reconcile failed for tenant', tenantId, err)
  }
}
