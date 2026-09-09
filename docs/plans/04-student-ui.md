# How to ship minimum Canvas-like student views

This is PR-04 in `docs/plans/boteducation-program.md`. Depends on PR-02. PR-03 may land in parallel for bot grading, but student submit does not wait on Grok.

## Goal

A student in one school can open a course home, see assignments with deadlines, submit text or files, see published grades, read course announcements, and see a calendar of assignment and exam deadlines. This is the human roster experience. Professors still do not need to click these pages.

## Files to touch

Reuse the student dashboard shell.

- `app/[locale]/dashboard/student/courses/[courseId]/page.tsx`. Add upcoming assignments, announcements, and a link to calendar.
- New `app/[locale]/dashboard/student/courses/[courseId]/assignments/page.tsx`
- New `app/[locale]/dashboard/student/courses/[courseId]/assignments/[assignmentId]/page.tsx` (detail plus submit)
- New `app/[locale]/dashboard/student/courses/[courseId]/grades/page.tsx`
- New `app/[locale]/dashboard/student/courses/[courseId]/calendar/page.tsx` or `app/[locale]/dashboard/student/calendar/page.tsx` for all courses
- Server actions under `app/actions/student/` for submit. Call Supabase with the user client, never the admin client, for writes.
- Student nav component that lists Courses, Assignments, Grades, Calendar.

Do not add a marketing landing page. Do not rebuild the lesson MDX player in this PR. Keep exams at their current routes.

`CourseOverviewPage` currently uses `createAdminClient()`. Do not copy that for assignment submits. Use the session client so RLS is the access control.

## Schema changes

None if PR-02 landed. If a storage bucket for submission files is missing, add a private bucket `assignment-submissions` with policies that allow the student to upload into `/{user_id}/{assignment_id}/` and staff to read.

## Views

Course home shows title, published lessons (existing), assignment list with `due_at`, latest announcements.

Assignment detail shows `body`, rubric, `max_score`, late policy in words, submit form (textarea plus optional file). After submit, show `submitted_at` and late flag.

Grades show published assignment scores and published exam scores. Unpublished AI grades appear as pending, not as a number.

Calendar lists `course_calendar_items` for enrolled courses, sorted by `due_at`.

## Acceptance checks

- Enrolled student opens course home and sees an assignment created in PR-02 or via MCP.
- Student submits before `due_at`. Row status is `submitted`.
- Student submits after `due_at` with `late_policy.kind = reject` and the action returns an error. No new submitted row.
- Unpublished grade is invisible on the grades page. After publish, the score appears.
- Calendar shows the assignment `due_at` and an exam time for the same course.
- A user who is not enrolled gets notFound or the existing access guard (`requireCourseAccess`).
- `npm run typecheck` exits 0.

## Risks

- Admin-client reads on the current course page hide RLS bugs. New pages must not expand that pattern.
- File uploads need Storage. Text-only submit is the fallback if Storage is not configured. Ship text first if the bucket is the long pole.
- i18n keys. Add English strings. Spanish may fall back. That is acceptable.
- Locale prefix `[locale]` stays. Do not fork a non-i18n app router in this PR.
