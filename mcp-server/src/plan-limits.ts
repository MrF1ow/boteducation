import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Plan-limit helpers leftover from issue #658.
 *
 * Self-hosted leftover cleanup PR-01 dropped `enforce_course_plan_limit`,
 * `enforce_student_plan_limit`, and `get_tenant_plan_usage`. MCP course and
 * member writes must not read Free caps or emit upgrade copy.
 */

export const PLAN_LIMIT_SQLSTATE = "LM001";

export type PlanLimitResource = "courses" | "students";

const MESSAGE_PATTERN = /plan_limit_exceeded:(courses|students)/;

export function isPlanLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { code, message } = err as { code?: unknown; message?: unknown };
  return (
    code === PLAN_LIMIT_SQLSTATE ||
    (typeof message === "string" && MESSAGE_PATTERN.test(message))
  );
}

export interface TenantPlanUsage {
  courses: number;
  students: number;
  /** `-1` means unlimited. */
  max_courses: number;
  /** `-1` means unlimited. */
  max_students: number;
}

/** Usage RPC is gone. Callers must treat missing usage as unlimited. */
export async function getTenantPlanUsage(
  _supabase: SupabaseClient,
  _tenantId: string
): Promise<TenantPlanUsage | null> {
  return null;
}

/** Upgrade copy is retired. The database no longer refuses these writes. */
export async function planLimitMessage(
  _supabase: SupabaseClient,
  _tenantId: string,
  _resource: PlanLimitResource
): Promise<string> {
  return "Course and student writes are not limited by a platform plan.";
}

/**
 * Pre-check before a write that would add one non-archived course.
 * Always `null`: there is no Free cap to read.
 */
export async function courseLimitHeadroomError(
  _supabase: SupabaseClient,
  _tenantId: string
): Promise<string | null> {
  return null;
}
