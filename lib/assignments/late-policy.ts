export type LatePolicy =
  | { kind: 'reject' }
  | { kind: 'accept' }
  | { kind: 'accept_until'; until: string }
  | { kind: 'penalize'; percent_per_day: number }

export const DEFAULT_LATE_POLICY: LatePolicy = { kind: 'reject' }

export function parseLatePolicy(raw: unknown): LatePolicy {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULT_LATE_POLICY
  }
  const kind = 'kind' in raw ? raw.kind : undefined
  if (kind === 'reject' || kind === 'accept') {
    return { kind }
  }
  if (kind === 'accept_until') {
    const until = 'until' in raw ? raw.until : undefined
    if (typeof until !== 'string' || until.length === 0) {
      return DEFAULT_LATE_POLICY
    }
    return { kind: 'accept_until', until }
  }
  if (kind === 'penalize') {
    const percent = 'percent_per_day' in raw ? raw.percent_per_day : undefined
    if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0) {
      return DEFAULT_LATE_POLICY
    }
    return { kind: 'penalize', percent_per_day: percent }
  }
  return DEFAULT_LATE_POLICY
}

export function isAfterDue(dueAt: string | null, at: Date): boolean {
  if (dueAt === null) return false
  return at.getTime() > Date.parse(dueAt)
}

export function allowsStudentResubmit(policy: LatePolicy, at: Date): boolean {
  switch (policy.kind) {
    case 'reject':
      return false
    case 'accept':
    case 'penalize':
      return true
    case 'accept_until':
      return at.getTime() <= Date.parse(policy.until)
    default: {
      const _exhaustive: never = policy
      return _exhaustive
    }
  }
}

export function submissionStatus(
  dueAt: string | null,
  at: Date,
  policy: LatePolicy,
): 'submitted' | 'late' | 'rejected' {
  if (!isAfterDue(dueAt, at)) return 'submitted'
  switch (policy.kind) {
    case 'reject':
      return 'rejected'
    case 'accept_until':
      return at.getTime() <= Date.parse(policy.until) ? 'late' : 'rejected'
    case 'accept':
    case 'penalize':
      return 'late'
    default: {
      const _exhaustive: never = policy
      return _exhaustive
    }
  }
}

export function decideSubmissionWrite(
  dueAt: string | null,
  policy: LatePolicy,
  at: Date,
  existingStatus: string | null,
): { ok: true; status: 'submitted' | 'late' } | { ok: false; reason: 'late_rejected' | 'locked' } {
  const status = submissionStatus(dueAt, at, policy)
  if (status === 'rejected') {
    return { ok: false, reason: 'late_rejected' }
  }
  if (
    existingStatus !== null &&
    existingStatus !== 'draft' &&
    !allowsStudentResubmit(policy, at)
  ) {
    return { ok: false, reason: 'locked' }
  }
  return { ok: true, status }
}

export function applyLatePenalty(
  score: number,
  policy: LatePolicy,
  dueAt: string | null,
  at: Date,
): number {
  if (policy.kind !== 'penalize' || !isAfterDue(dueAt, at) || dueAt === null) {
    return score
  }
  const daysLate = Math.max(
    1,
    Math.ceil((at.getTime() - Date.parse(dueAt)) / 86_400_000),
  )
  const penalized = score * (1 - (policy.percent_per_day * daysLate) / 100)
  return Math.max(0, penalized)
}
