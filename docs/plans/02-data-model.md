# How to revive assignments and bind professor bots

This is PR-02 in `docs/plans/boteducation-program.md`. It lands before MCP and UI. Types and RLS come first so tools and pages share one shape.

## Goal

Make assignments, submissions, homework grades, course announcements, professor-bot bindings, and a calendar source first-class in Postgres with RLS. Reuse empty `assignments` and `submissions`. Retarget `grades.submission_id` off `exam_submissions` before using that table for homework, or add `assignment_grades`. Keep `teacher` in `app_role` and `tenant_users.role`. Treat professor as the product name for `teacher`.

## Domain shape

One school is one `tenants` row. A course has many assignments and exams. An assignment has many submissions. A submission has at most one grade row. A grade is draft until `published` is true, unless `tenant_settings` key `auto_publish_grades` is true. A course has many `course_professor_bots`. Calendar rows are a view over assignment `due_at` and exam times, not a stored duplicate.

Late policy is data on the assignment (and copied onto the bot config as a default). Do not scatter due-date math across MCP tools.

## Files to touch

- New migration under `supabase/migrations/` (one file, additive).
- `lib/database.types.ts` via `npm run db:types` after a local reset, or a hand-updated slice if Docker is still missing. Prefer generated types.
- Optional domain helpers in `lib/` for late-policy and publish-gate. Keep them pure. The MCP and UI import the same helpers.

## Schema changes

### Extend `assignments`

Add columns. Keep `assignment_id` and `course_id`.

- `body text`. Use this as the assignment prompt. Keep `description` in sync or migrate it into `body` and stop writing `description`.
- `due_at timestamptz`. Backfill from `due_date`, then stop writing `due_date`.
- `late_policy jsonb not null default '{"kind":"reject"}'`. Allowed kinds are `reject`, `accept`, `accept_until` (with `until`), `penalize` (with `percent_per_day`).
- `max_score numeric not null default 100`
- `rubric jsonb` (criteria array, each with `name`, `points`, `description`)
- `created_by uuid references auth.users(id)`
- `published boolean not null default true` (the assignment itself, not the grade)

Replace `Authenticated users can view assignments` (`USING (true)` in `supabase/migrations/20260313152153_rls_remaining_tables.sql`). Student SELECT only when enrolled (or entitled) in that `course_id`. Staff ALL via `is_staff_of(course.tenant_id)`. The table has no `tenant_id`. Gate through `courses`, same as the later staff policy in `20260830140000_rls_tenant_scope_sweep.sql`.

### Extend `submissions`

- `body text` for text work
- `files jsonb` for storage paths (keep `file_path` until writers move)
- `submitted_at timestamptz` backfill from `submission_date`
- `status text` check in `draft`, `submitted`, `late`
- Unique `(assignment_id, student_id)` so retries update one row

Student INSERT/UPDATE own row before lock. Staff SELECT. No student UPDATE after `submitted` unless late policy allows resubmit.

### Homework grades (do not reuse `grades` as-is)

`lib/database.types.ts` shows `grades.submission_id` pointing at `exam_submissions`, not at homework `submissions`. The constraint is `grades_submission_id_fkey` in `supabase/migrations/20260126190500_lms_complete.sql`. Exam scores already live on `exam_submissions` and `exam_scores`. Zero app callers write `grades`.

In the same additive migration, if `grades` is empty (expected), drop `grades_submission_id_fkey` and retarget it to `public.submissions(submission_id)`. Then add the homework columns.

- `score numeric` (keep `grade` as generated or backfill; pick one name in code and write only that column)
- `feedback text` (already present)
- `graded_by uuid references auth.users(id)`
- `published boolean not null default false`
- `source text` check in `human`, `ai`

Replace today's student SELECT (`auth.uid() = student_id` with no publish gate, `supabase/migrations/20260313152153_rls_remaining_tables.sql`) with student SELECT only when `published`. Staff ALL via `is_staff_of` on the course tenant, not `get_tenant_role()` with no tenant predicate.

If the FK retarget is blocked by leftover exam rows, create `assignment_grades` instead and leave `grades` untouched until PR-01. Do not insert homework scores into a table that still FKs to `exam_submissions`.

Service-role MCP still uses the user-scoped client so RLS applies. Professor tokens must not use the service role for these writes.

### Course announcements

Do not create a third notifications system if `notifications` with `target_type = 'course'` and `notification_type = 'announcement'` can be the write target. Add a thin CHECK or helper that MCP `post_announcement` always sets those fields and `status = 'sent'`. If targeting is too wide, add `course_announcements (id, course_id, title, body, created_by, created_at)` with RLS. Prefer one table. Inspect `app/actions/admin/notifications.ts` before adding.

### Professor bindings

New table `course_professor_bots`.

- `id uuid primary key default gen_random_uuid()`
- `course_id` FK courses
- `name text not null`
- `system_prompt text not null default ''`
- `rubric_rules text not null default ''`
- `late_policy jsonb` default copied from assignment default
- `model text not null default 'grok-4'`
- `tool_allowlist text[]` (MCP tool names this bot may call)
- `mcp_token_id bigint references mcp_api_tokens(id) on delete set null`
- Unique `(course_id, name)`

Staff only. Students get no SELECT.

### Token scope

Alter `mcp_api_tokens`.

- `course_ids int[]` null means every course the user staffs
- `token_role text` check in `professor`, `admin` default `professor`

Update `validate_mcp_api_token` to return `course_ids` and `token_role`. Keep the hash-only storage. Never put the raw token in git or in `mcp_audit_log`.

### Auto-publish

Insert or document `tenant_settings` key `auto_publish_grades` with value `{"enabled": false}`. Admin UI in PR-05 toggles it. MCP grade tools in PR-03 read it.

### Calendar

Create view `course_calendar_items` with columns `course_id`, `item_kind` (`assignment` | `exam`), `item_id`, `title`, `due_at`. RLS via underlying tables. No extra grants to anon.

## Acceptance checks

- `supabase/migrations/` contains one new file that applies on `npm run db:reset`.
- A staff user can insert an assignment and a student enrollment can SELECT it. A second student in another course cannot.
- A student can insert a submission for an enrolled assignment and cannot read an unpublished grade.
- `course_professor_bots` has RLS. A student JWT select returns zero rows.
- `validate_mcp_api_token` returns `course_ids` for a scoped token.
- `npm run typecheck` exits 0.

## Risks

- Integer `assignment_id` vs uuid elsewhere. Stay on integers to match courses and exams.
- `grades.grade` CHECK 0 to 100 vs `max_score` other than 100. Replace the check with `0 <= score <= assignment.max_score` or store percent. Pick one in the migration and test it.
- Token `course_ids` without RLS would be security theater. Tools must use the user client. Scope is an extra deny, not a bypass.
- `notifications` reuse may send email. MCP announcements should stay in-app until email is an explicit setting.
- `grades` currently FKs to exams. A homework insert would fail or attach to the wrong row until that constraint is retargeted.
- `assignments` SELECT `USING (true)` leaks every school's homework to any logged-in user until replaced.
