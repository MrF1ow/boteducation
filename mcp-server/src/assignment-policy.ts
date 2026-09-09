export type LatePolicy =
  | { kind: "reject" }
  | { kind: "accept" }
  | { kind: "accept_until"; until: string }
  | { kind: "penalize"; percent_per_day: number };

export const DEFAULT_LATE_POLICY: LatePolicy = { kind: "reject" };

export function parseLatePolicy(raw: unknown): LatePolicy {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_LATE_POLICY;
  }
  const kind = "kind" in raw ? raw.kind : undefined;
  if (kind === "reject" || kind === "accept") {
    return { kind };
  }
  if (kind === "accept_until") {
    const until = "until" in raw ? raw.until : undefined;
    if (typeof until !== "string" || until.length === 0) {
      return DEFAULT_LATE_POLICY;
    }
    return { kind: "accept_until", until };
  }
  if (kind === "penalize") {
    const percent = "percent_per_day" in raw ? raw.percent_per_day : undefined;
    if (typeof percent !== "number" || !Number.isFinite(percent) || percent < 0) {
      return DEFAULT_LATE_POLICY;
    }
    return { kind: "penalize", percent_per_day: percent };
  }
  return DEFAULT_LATE_POLICY;
}

export function parseAutoPublishSetting(raw: unknown): boolean {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return false;
  }
  return "enabled" in raw && raw.enabled === true;
}

export function publishedOnWrite(autoPublishEnabled: boolean): boolean {
  return autoPublishEnabled;
}

/**
 * Auto-publish is the only writer-side override. A model passing
 * `published: true` is ignored when the tenant setting is off.
 */
export function publishedFlagForGradeWrite(
  autoPublishEnabled: boolean,
  requestedPublished?: boolean,
): boolean {
  void requestedPublished;
  return publishedOnWrite(autoPublishEnabled);
}

export function isCourseInScope(
  allowed: number[] | null,
  courseId: number,
): boolean {
  if (allowed === null) return true;
  return allowed.includes(courseId);
}

export function parseCourseIdsHeader(
  value: string | null | undefined,
): number[] | null {
  if (!value || value.trim() === "") return null;
  const ids = value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ids.length > 0 ? ids : null;
}

export function assignmentCreateRow(
  input: {
    course_id: number;
    title: string;
    body?: string;
    due_at?: string;
    late_policy?: unknown;
    max_score?: number;
    rubric?: unknown;
  },
  userId: string,
): {
  course_id: number;
  title: string;
  body: string | null;
  due_at: string | null;
  late_policy: LatePolicy;
  max_score: number;
  rubric: unknown;
  created_by: string;
  published: boolean;
} {
  return {
    course_id: input.course_id,
    title: input.title,
    body: input.body ?? null,
    due_at: input.due_at ?? null,
    late_policy: input.late_policy
      ? parseLatePolicy(input.late_policy)
      : DEFAULT_LATE_POLICY,
    max_score: input.max_score ?? 100,
    rubric: input.rubric ?? null,
    created_by: userId,
    published: true,
  };
}
