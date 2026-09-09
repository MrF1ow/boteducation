# How to expand MCP into a professor API

This is PR-03 in `docs/plans/boteducation-program.md`. Depends on PR-02. Extend `mcp-server/src/tools`. Do not add a second protocol.

## Goal

A Grok bot with a bearer token can run the school through tools. The operator pastes `https://<their-domain>/api/mcp` plus a token scoped to the school and optional `course_ids` with `role=professor`. Writes land in `mcp_audit_log`. Grades stay unpublished unless `tenant_settings.auto_publish_grades` is enabled. Tokens never outrank RLS.

## Auth at the boundary

Today Bearer tokens work only on `/api/mcp/cli` (`app/api/mcp/[[...path]]/route.ts` `handleCliRequest`). Grok config wants `/api/mcp`. Accept the same Bearer token on the main MCP path. Keep `/cli` as an alias.

`validate_mcp_api_token` must return `user_id`, `user_role`, `token_id`, `course_ids`. Build a user-scoped Supabase client from that user, not the service role, for tool queries. Service role stays limited to `recordToolAudit`.

If `course_ids` is non-empty, reject tool calls whose `course_id` (or parent course) is outside that set before the handler runs. Put this in `installToolGuards` (`mcp-server/src/register.ts`) so every tool shares one check.

`mcp_audit_log.user_role` currently allows `teacher` and `admin`. Include `professor` if you persist that string, or write `teacher` when the product role is professor. Keep the check constraint in sync.

## Files to touch

- `app/api/mcp/[[...path]]/route.ts`. Bearer on `/api/mcp`.
- `supabase/migrations/` only if the check constraint on `mcp_audit_log.user_role` still blocks professor.
- `mcp-server/src/tools/` new module `assignments.ts` (or split gradebook). Register it in `mcp-server/index.ts`.
- `mcp-server/src/tools/analytics.ts`. Keep exam `lms_grade_submission`. Do not overload it for assignments. Add `lms_grade_assignment_submission` with a clearer name.
- `mcp-server/src/register.ts` and `mcp-server/src/tool-policy.ts` for allowlists per bot.
- `mcp-server/src/audit.ts`. Every write tool must go through the existing guard so audit cannot be skipped.
- Vitest tests next to the new tools.

## Tool list (xAI-compatible)

Clear names, descriptions, JSON parameters. Prefer `lms_` prefix already used.

Keep.

- `lms_get_course`
- `lms_create_lesson`, `lms_update_lesson`, `lms_publish_lesson`
- `lms_create_exam`, `lms_update_exam`

Add or alias.

- `lms_list_roster` (thin wrapper on `lms_list_enrollments` / `lms_get_student_progress`, filter by course)
- `lms_create_assignment` (`course_id`, `title`, `body`, `due_at`, `late_policy`, `max_score`, `rubric`)
- `lms_update_assignment`
- `lms_set_deadline` (`assignment_id`, `due_at`) 
- `lms_list_submissions` (`assignment_id`)
- `lms_get_submission` (`submission_id` for assignment submissions)
- `lms_grade_assignment_submission` (`submission_id`, `score`, `feedback`). Default `published=false`. If auto-publish is on, set `published=true` and record that in the audit params.
- `lms_publish_grade` (`grade_id` or `submission_id`). Separate on purpose.
- `lms_post_announcement` (`course_id`, `title`, `body`)
- `lms_list_grades` / `lms_get_gradebook` (`course_id`)

Do not add a Grok chat UI.

Tool allowlist on `course_professor_bots` is a second deny list. A token without a bot row still has only the professor tools, never platform billing tools.

## Publish gate

Pure helper, one function, used by grade tools.

- Input is tenant setting plus the requested `published` flag.
- If auto-publish is false, ignore a model-requested `published=true` on `lms_grade_assignment_submission` and return the draft. Tell the model to call `lms_publish_grade`.
- If auto-publish is true, persist published.
- Admin human grades in the UI may publish without this gate.

## Acceptance checks

- A professor token listed in `mcp_api_tokens` can call `tools/list` on `POST /api/mcp` and see the professor tools.
- `lms_create_assignment` inserts a row the student RLS can read.
- `lms_grade_assignment_submission` with default settings leaves `grades.published = false`. The student JWT cannot SELECT it.
- `lms_publish_grade` then makes it visible to that student.
- A token with `course_ids = {1}` cannot create an assignment on course 2.
- A write with the service-role key omitted still succeeds as a tool, and audit either inserts or increments `getAuditInsertFailureCount`. Writes must not depend on audit success. A missing audit must be loud in logs.
- `npm test` in `mcp-server/` covers create, grade-draft, publish, and course-scope deny.

## Risks

- Dual `/api/mcp` vs `/api/mcp/cli` will confuse operators if both behave differently. Make them identical for Bearer.
- `lms_grade_submission` already means exam. Renaming it would break existing clients. Add assignment tools with new names.
- Widgets in mcp-use are optional. Professor tools should return JSON text first. Widgets can wait.
- Plan-limit helpers in course create (`plan-limits.ts`) must not block a self-hosted school. If they throw, catch and ignore when no paid plan is configured.
