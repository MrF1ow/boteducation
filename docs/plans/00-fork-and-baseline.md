# How to fork lms-front and record the BotEducation baseline

This is PR-00 in `docs/plans/boteducation-program.md`. Do this before schema or MCP work.

## Goal

Keep the MIT git history from [guillermoscript/lms-front](https://github.com/guillermoscript/lms-front). Put it in a repo named `boteducation` on the operator's GitHub account. Prove the documented local path, or write the blockers. Inventory MCP tools, roles, and the unused assignment tables so later PRs extend real files.

## What this session already did

Work lives in `/agent/boteducation` on branch `cursor/fork-and-plans-8f23`.

- Upstream clone with full history. `origin` still points at `https://github.com/guillermoscript/lms-front.git`.
- HEAD `33f32ada3fd9d18ace44f540c460c4636a30a3a3` (`docs(qa): before-evidence for #684 paid-course checkout intent`).
- `git rev-list --count HEAD` is 2661.
- LICENSE is MIT, copyright Guillermo Marin, 2026.
- `npm install` completed on Node v22.14.0. `lint-staged@17.3.0` wants Node `>=22.22.1`. That is a warning, not a failed install.
- `npm run typecheck` (`tsc --noEmit`) exited 0.

## Fork blocker

`gh` has no credentials. `GH_TOKEN` is unset. This cloud run started without a GitHub repo, so Cursor did not mint a GitHub token.

The remote named `boteducation` does not exist yet. Do not treat a local folder as the fork.

Two GitHub users are named Ethan Flow in Johnson City, TN.

- [ejflow](https://github.com/ejflow) matches the Cursor email prefix `ejflow@proton.me`. Zero public repos. Created 2026-06-16.
- [MrF1ow](https://github.com/MrF1ow) is the older coding account (`ethanflow.dev`).

On go, set `GH_TOKEN` for the chosen account and run this.

```bash
gh repo fork guillermoscript/lms-front --fork-name boteducation --clone=false
cd /agent/boteducation
git remote rename origin upstream
git remote add origin git@github.com:<account>/boteducation.git
git push -u origin cursor/fork-and-plans-8f23
```

Intended URL after that push is `https://github.com/<account>/boteducation`.

## Local Supabase blocker

`docs/GETTING_STARTED.md` and the README require Docker, then `supabase start`, then `npm run db:reset`. This VM has no `docker` binary. `npx supabase --version` prints `2.117.0`. `supabase start` cannot run here.

The documented browser path is `http://lvh.me:3000`, not `localhost`. Tenant resolution on `localhost` sends authenticated users to `/join-school`.

Seeded local logins (password `password123`) are in the README. They need a running local database.

## Files to touch in PR-00

- `README.md`. Say BotEducation is a self-hosted school. Credit lms-front. Keep MIT. Do not write a marketing site.
- `package.json`. Rename `lms-front` to `boteducation` only if it does not break workspace scripts. Record the result.
- `.env.example`. Keep secrets out of git. Add a short comment that commerce keys are unused in BotEducation. Do not delete them in this PR.
- `docs/plans/00-fork-and-baseline.md` through `06-readme.md` and `docs/plans/boteducation-program.md`. Already the source of truth for owners.

Do not delete Stripe, tenants, or gamification in this PR.

## Schema changes

None.

## Inventory (regenerate with the commands in each list)

### MCP tools

Tools live under `mcp-server/src/tools/`. Registration is `mcp-server/index.ts`. Guards and audit are `mcp-server/src/register.ts` (`installToolGuards`) and `mcp-server/src/audit.ts` (`recordToolAudit` into `mcp_audit_log`).

Public URL today is a Next.js proxy at `app/api/mcp/[[...path]]/route.ts`. Bearer CLI tokens hit `/api/mcp/cli` and `validate_mcp_api_token`. The handler forwards `X-User-*` headers and does not mint a user JWT. `mcp-server/src/session.ts` `resolveMcpAuth` reads JWT only. Session and OAuth use other subpaths. BotEducation wants Grok to paste `https://<domain>/api/mcp`. That path does not yet accept a professor bearer token that can call tools under RLS.

Role gate is `isToolAllowedForRole` in `mcp-server/src/tool-policy.ts`. About 91 live tools plus demo widgets. Teacher is denied admin-only deletes, archive, school stats, and landing-page tools.

Existing tools that already match professor work, with today's names.

- `lms_get_course`, `lms_list_courses` in `mcp-server/src/tools/courses.ts`
- `lms_create_lesson` and related lesson writes in `mcp-server/src/tools/lessons.ts`
- `lms_create_exam` and related exam writes in `mcp-server/src/tools/exams.ts`
- `lms_list_enrollments`, `lms_get_student_progress` in `mcp-server/src/tools/analytics.ts` (roster-shaped)
- `lms_list_exam_submissions`, `lms_get_submission_details`, `lms_get_submission_for_grading`, `lms_grade_submission` in `mcp-server/src/tools/analytics.ts`. These write `exam_submissions` and `exam_scores`, not `assignments` / `submissions` / `grades`.

Missing professor tools (add in PR-03).

- assignment create, update, deadline
- assignment submission list and get
- assignment grade draft and publish
- course announcement
- gradebook over assignments plus exams

Token table `mcp_api_tokens` (`supabase/migrations/20260214140159_create_mcp_api_tokens.sql`) is per-user. It has no `course_ids` column and no `role=professor` scope. `validate_mcp_api_token` (`supabase/migrations/20260301193428_fix_validate_mcp_api_token_rpc.sql`) returns a `tenant_users` role in `('teacher','admin')`.

Audit writes are fire-and-forget in `recordToolAudit`. They no-op without `SUPABASE_SERVICE_ROLE_KEY`. `mcp_audit_log.user_role` currently checks `IN ('teacher','admin')`.

Test command for the MCP package is `npm test` inside `mcp-server/` (Vitest).

### Role model

`public.app_role` is `'admin' | 'moderator' | 'teacher' | 'student'` (`supabase/migrations/20260126190500_lms_complete.sql`). Authoritative school membership is `tenant_users.role` (`supabase/migrations/20260216200000_create_multi_tenant_infrastructure.sql`). App helper `getUserRole` in `lib/supabase/get-user-role.ts` returns `'student' | 'teacher' | 'admin'`.

BotEducation product names are admin, professor, student. Keep `teacher` in Postgres for PR-00 through PR-05. Map professor to `teacher` at the MCP and UI boundary. Do not rename the enum until a later sweep.

### Assignments, submissions, grades

Tables exist in `supabase/migrations/20260126190500_lms_complete.sql`.

- `assignments` (`assignment_id`, `course_id`, `title`, `description`, `due_date`, `created_at`)
- `submissions` (`submission_id`, `assignment_id`, `student_id`, `submission_date`, `file_path`)
- `grades` (`grade_id`, `submission_id`, `student_id`, `course_id`, `grade`, `feedback`, `graded_at`, score 0 to 100). `grades_submission_id_fkey` points at `exam_submissions`, not homework `submissions`.

Generated types exist in `lib/database.types.ts`. No app `.from('assignments')` / `.from('submissions')` / `.from('grades')` call was found. Staff RLS later uses `is_staff_of`. Assignment SELECT is still `USING (true)` from `20260313152153_rls_remaining_tables.sql`.

Revive `assignments` and `submissions`. Retarget or replace `grades` in PR-02. Do not write homework scores through the exam FK.

### Announcements and calendar

`notifications` (`supabase/migrations/20260214155813_create_notifications_system.sql`) already has `notification_type = 'announcement'` and `target_course_id`. Admin UI lives under `app/actions/admin/notifications.ts`. There is no student calendar route. Exam dates and assignment `due_date` are not composed into one calendar view.

### Auto-publish grades

Exam review states include `pending`, `ai_reviewed`, `pending_teacher_review`, `teacher_reviewed`. `lms_grade_submission` writes `teacher_reviewed` immediately. There is no school setting that keeps AI grades unpublished. Use `tenant_settings` (`setting_key` / `setting_value`) for `auto_publish_grades` in PR-02 rather than a new table.

## Acceptance checks

- Remote `https://github.com/<account>/boteducation` exists, is a fork of `lms-front`, and contains this history (`git log -1` still reaches `33f32ada` as an ancestor).
- `npm install` and `npm run typecheck` still pass on the fork.
- If Docker is available, `supabase start` then `npm run db:reset` then `npm run dev` then login at `http://lvh.me:3000` as `student@e2etest.com`.
- If Docker is missing, this file still lists that blocker. Do not pretend the browser path ran.

## Risks

- Forking to the wrong GitHub account is painful to undo. Wait for the operator's account choice plus `GH_TOKEN`.
- Keeping `origin` on `lms-front` and pushing by accident would target upstream. Rename remotes before the first push.
- Local tenant UX depends on `lvh.me`. Cloud live lanes must use that host, not `localhost`.
- Leaving commerce in the tree means payment routes still compile. That is intended until PR-01.
