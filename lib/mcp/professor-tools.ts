export const PROFESSOR_TOOL_OPTIONS = [
  'lms_get_course',
  'lms_create_lesson',
  'lms_update_lesson',
  'lms_publish_lesson',
  'lms_create_exam',
  'lms_update_exam',
  'lms_create_assignment',
  'lms_update_assignment',
  'lms_set_deadline',
  'lms_list_submissions',
  'lms_get_submission',
  'lms_grade_assignment_submission',
  'lms_publish_grade',
  'lms_post_announcement',
  'lms_get_gradebook',
  'lms_list_roster',
] as const

export type ProfessorToolName = (typeof PROFESSOR_TOOL_OPTIONS)[number]

const PROFESSOR_TOOL_SET = new Set<string>(PROFESSOR_TOOL_OPTIONS)

export function sanitizeToolAllowlist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((name): name is string =>
    typeof name === 'string' && PROFESSOR_TOOL_SET.has(name),
  ))]
}
