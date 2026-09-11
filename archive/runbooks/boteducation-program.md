# BotEducation program (archived)

Historical pstack runbook. Not operator documentation.

Implementation landed on `master` in [MrF1ow/boteducation#10](https://github.com/MrF1ow/boteducation/pull/10) (`e9708b31`). Operator docs live in `README.md`, `docs/GETTING_STARTED.md`, and `docs/MCP_SETUP.md`.

**How boxes were marked.** Files, Build, and You see are checked when the matching code exists in that commit. Verify unit is checked when a test file exists, even if it only covers helpers. Verify live and Verify perf stay unchecked: the ten-lane screenshots and perf receipts were never stored in the repo. Merge is checked only for "the operator lands it", which happened as GitHub PR #10. Arm / spawn / pstack cadence boxes stay unchecked because that process did not run here.

**Still open after #10.** Student submit is text only (`files: []`). `course_professor_bots.tool_allowlist` is stored in admin UI and is not read by `mcp-server/`. `lms_list_grades` was never added; use `lms_get_gradebook`. Payment route files still redirect or return 410; leftover payment modules may remain. Token page still shows a Claude connector card. Playwright `homework-happy-path.spec.ts` skips unless `PROFESSOR_PAT` or `/tmp/professor-pat.txt` is set.

---


BotEducation turns a fork of lms-front into a self-hosted school where Grok bots run courses through MCP.
Operators clone it, run Next.js on their Supabase, and paste `/api/mcp` into a Grok bot.
The rule is one school per deploy, no SaaS billing, and no professor click-ops.
Execute in order PR-00, PR-02, PR-03, PR-04, PR-05, PR-01, PR-06.
Owners stop at merge-ready. The operator lands the stack.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-stack.md`. The operator merges PR-00 through PR-06. Owners never squash-merge.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

How-to files the owner reads before coding are `docs/plans/00-fork-and-baseline.md` through `docs/plans/06-readme.md`. Those files were deleted after this archive. The quotes below are historical.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on her explicit go.
- [ ] On her go, arm a `/goal` with this exact text. "docs/plans/boteducation-program.md, PR-00 then PR-02 then PR-03 then PR-04 then PR-05 then PR-01 then PR-06. Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. The operator lands the stack. Done when a student submits an assignment, a Grok professor token grades it as a draft, an admin can publish, and commerce nav is gone."
- [ ] Read these from trunk at program start. Re-read them at every tick.
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-stack.md`
  - [ ] `git show origin/main:pstack/skills/swarm/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/control-ui/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/opening-a-pr.md`
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/opening-a-pr.md` again if the first read is stale, plus `docs/plans/00-fork-and-baseline.md`
- [ ] Arm the 30-minute audit tick. In a local session, a real terminal `/loop`. In a cloud root, a cloud-sleeper wake chain. Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the execution playbook from trunk and the armed /goal. Audit the operation against both and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then send the operator a status message, whether or not anything changed, with the queue table of PR, owner, state, and head SHA, the verdicts since the last tick, what merged, open operator gates, and blockers."
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once.

### Spawn owners

- [ ] Spawn one owner per PR with the full lifecycle the execution playbook names.
- [ ] Follow this dependency graph. Start dependent work only after its parent merges, or base it on the parent branch when the execution playbook stacks.
  - [ ] PR-00 is first from `main`.
  - [ ] PR-02 after PR-00.
  - [ ] PR-03 after PR-02.
  - [ ] PR-04 after PR-02 and may stack beside PR-03.
  - [ ] PR-05 after PR-03.
  - [ ] PR-01 after PR-04 and PR-05.
  - [ ] PR-06 after PR-00 and retarget after PR-01.
- [ ] Hold the file boundaries. PR-00 and PR-06 touch docs and README. PR-02 touches `supabase/migrations` and types. PR-03 touches `mcp-server` and `app/api/mcp`. PR-04 touches student dashboard routes. PR-05 touches admin token and course settings. PR-01 touches commerce routes and nav.
- [ ] Hold the review gate. PR-04, PR-05, and PR-01 change an interaction. They wait for the operator's review in chat with screenshots and a video before merge.

### PR mechanics, for every PR

- [ ] Resolve the forge once. Default to `gh`. If `command -v origin` succeeds and Origin can resolve the repository, use `origin pr` for every PR operation. Record any fallback to `gh`. Never require `gt`.
- [ ] Open the PR ready, never draft, with `gh pr create --base <base-branch>` according to the resolved forge. A stack child targets its parent branch.
- [ ] Run the repo's lint and typecheck once before the PR-facing push. Push with hooks on.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment per `pstack/skills/poteto-mode/references/bugbot-triage.md`.
- [ ] Rebase onto current trunk before babysit and again before the merge-ready report.

### Verdict and merge, for every PR

- [ ] At the merge-ready head SHA, run the swarm per `pstack/skills/swarm/SKILL.md`. One gates lane. The ten live lanes from the PR's **Verify, live** block. The perf lane from its **Verify, perf** block. One audit lane that reads the diff and the receipts and distrusts the PR body.
- [ ] Clean only when every lane is `PASS`. Findings go back to the owner. A new head gets a fresh swarm and a fresh verdict.
- [ ] The root appends the PR to the base-branch stack. The operator lands it bottom-up. Compare `git patch-id` after rebase per `pstack/skills/poteto-mode/playbooks/shipping.md`.

### Boot recipe, for every live lane

Each live lane runs on its own cloud VM at the PR head. Drive through `control-ui` from `cursor-team-kit` when that skill is installed. If it is missing, drive Playwright against `http://lvh.me:3000` and record that fallback in the lane report. MCP lanes also `curl` `POST /api/mcp`.

- [ ] `git fetch origin <head-branch> && git checkout <head SHA>`.
- [ ] `npm install`. `supabase start` then `npm run db:reset` when Docker exists. `npm run dev`. `cd mcp-server && npm install && npm run build && npm run start` if the lane hits MCP. Wait until `http://lvh.me:3000` responds.
- [ ] Deliver input only through the control skill's commands or Playwright. Read-only diagnostics are the Network tab, `supabase status`, and MCP audit rows in `mcp_audit_log`.
- [ ] Save every screenshot to `/tmp/swarm-<pr-id>/worker-<n>/<slug>.png` and return the paths with the report.

## Record the fork baseline (PR-00)

**Depends on.** None.

**Files.**

- [x] Edit `README.md`.
- [x] Edit `.env.example`.
- [x] Create nothing else unless `package.json` name change is proven safe.

**Build.**

- [x] Point the README at self-host and credit lms-front. Do not delete commerce code.

**You see.**

- [x] README title names BotEducation and lms-front. `git log --oneline | wc -l` is still thousands.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [x] `npm run typecheck` at the PR head. Log in `receipts/pr-00-typecheck.txt`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run login at `http://lvh.me:3000` on trunk and head. If Docker is missing on trunk, record that and gate that `npm run typecheck` still exits 0 and README still names the `lvh.me` login. Save `pr-00-login.png`. Pass when head matches trunk boot or documents the same Docker blocker.
- [ ] Lane 2. Open the README on GitHub or in the editor preview. Save `pr-00-readme.png`. Pass when lms-front is credited and MIT is named.
- [ ] Lane 3. `cp .env.example /tmp/env-check && grep STRIPE /tmp/env-check`. Save `pr-00-env.png`. Pass when commerce keys are still listed and commented unused.
- [ ] Lane 4. `git merge-base --is-ancestor 33f32ada HEAD`. Save `pr-00-history.png`. Pass when the command exits 0.
- [ ] Lane 5. Open `/auth/login` on head. Save `pr-00-login-form.png`. Pass when the login form renders.
- [ ] Lane 6. Open `/dashboard/student` while logged out. Save `pr-00-auth-bounce.png`. Pass when the app redirects to auth, not a 500.
- [ ] Lane 7. `ls docs/plans/00-fork-and-baseline.md docs/plans/boteducation-program.md`. Save `pr-00-plans.png`. Pass when both files exist.
- [ ] Lane 8. `npm run lint` if it finishes under the lane budget, else `npx tsc --noEmit`. Save `pr-00-lint.png`. Pass when the command exits 0.
- [ ] Lane 9. Confirm `origin` is not force-pushed to `guillermoscript/lms-front`. Save `pr-00-remotes.png`. Pass when `git remote -v` shows the operator fork or a documented missing-token blocker.
- [ ] Lane 10. Seeded README table still names `student@e2etest.com`. Save `pr-00-seed.png`. Pass when that email is in README.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. `tsc --noEmit` wall time at trunk and head. Also record time to first byte on `http://lvh.me:3000/auth/login` when Docker runs.
- [ ] Probe. Run `time npm run typecheck` on trunk then head, interleaved. When Docker exists, `curl -o /dev/null -s -w '%{time_starttransfer}' http://lvh.me:3000/auth/login` on both.
- [ ] Baseline. Record the trunk typecheck seconds first.
- [ ] Rule. Head typecheck may not exceed trunk by more than 20 percent. If login TTFB is measured, fail head above 2s on a warm dev server.

**Review gate.** None. PR-00 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [x] Root appends it to the stack. The operator lands it.

## Extend the assignment schema (PR-02)

**Depends on.** PR-00.

**Files.**

- [x] Create `supabase/migrations/` additive migration for assignments, submissions, grades, professor bots, token columns, calendar view.
- [x] Edit `lib/database.types.ts` after generate, or the migration only if types are generated in CI.

**Build.**

- [x] Add the columns and tables named in `docs/plans/02-data-model.md`. Enable RLS on every new table.

**You see.**

- [x] `npm run db:reset` applies. Staff insert into `assignments` succeeds. Student select of unpublished `grades` returns zero rows.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [x] SQL tests or a Vitest RLS helper that inserts as student and staff. Run `npm run test:unit` for any new cases.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run student course home on trunk and head. Save `pr-02-course-home.png`. Pass when the course home still renders.
- [ ] Lane 2. Apply migrations on a fresh `supabase start`. Save `pr-02-reset.png`. Pass when `db:reset` exits 0.
- [ ] Lane 3. Insert an assignment as staff via SQL editor. Save `pr-02-insert.png`. Pass when the row exists.
- [ ] Lane 4. Select that assignment as the enrolled student. Save `pr-02-student-select.png`. Pass when one row returns.
- [ ] Lane 5. Select it as a student not in the course. Save `pr-02-deny.png`. Pass when zero rows return.
- [ ] Lane 6. Insert a grade with `published=false` and select as student. Save `pr-02-draft-grade.png`. Pass when zero rows return.
- [ ] Lane 7. Set `published=true` and select as student. Save `pr-02-pub-grade.png`. Pass when the score returns.
- [ ] Lane 8. Insert `course_professor_bots` as student. Save `pr-02-bot-deny.png`. Pass when the insert is rejected.
- [ ] Lane 9. Read `course_calendar_items` for a course with one assignment and one exam. Save `pr-02-cal.png`. Pass when both kinds appear.
- [ ] Lane 10. Create a token with `course_ids` and call `validate_mcp_api_token`. Save `pr-02-token.png`. Pass when `course_ids` is in the result.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. `db:reset` duration at trunk and head. Calendar view `select` time for one course.
- [ ] Probe. `time npm run db:reset` on trunk then head. `explain analyze` the calendar view on head, and a comparable exams-only query on trunk.
- [ ] Baseline. Record trunk `db:reset` seconds first.
- [ ] Rule. Head `db:reset` may not exceed trunk by more than 25 percent. Calendar `select` must finish under 100ms on seed data.

**Review gate.** None. PR-02 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [x] Root appends it to the stack. The operator lands it.

## Expand the professor MCP (PR-03)

**Depends on.** PR-02.

**Files.**

- [x] Edit `app/api/mcp/[[...path]]/route.ts`.
- [x] Edit `mcp-server/index.ts` and `mcp-server/src/register.ts`.
- [x] Create `mcp-server/src/tools/assignments.ts` (name may vary, one module).
- [x] Create matching Vitest files under `mcp-server/`.

**Build.**

- [x] Accept Bearer on `/api/mcp`. Add the professor tools listed in `docs/plans/03-mcp-professor.md`. Audit every write.

**You see.**

- [x] `POST /api/mcp` with a professor token lists `lms_create_assignment`. A grade call leaves `published` false.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [x] `mcp-server` Vitest cases for create, draft grade, publish, and course-scope deny. Run `npm test` in `mcp-server/`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Call `lms_get_course` on trunk and head with a teacher token. Save `pr-03-get-course.png`. Pass when the course payload still returns.
- [ ] Lane 2. `tools/list` on `POST /api/mcp` with Bearer. Save `pr-03-tools-list.png`. Pass when professor assignment tools are listed.
- [ ] Lane 3. `lms_create_assignment` on a staffed course. Save `pr-03-create.png`. Pass when the assignment id returns.
- [ ] Lane 4. `lms_set_deadline`. Save `pr-03-deadline.png`. Pass when `due_at` updates.
- [ ] Lane 5. Student submits via SQL or student UI, then `lms_list_submissions`. Save `pr-03-list-sub.png`. Pass when the student row appears.
- [ ] Lane 6. `lms_grade_assignment_submission` with auto-publish off. Save `pr-03-draft.png`. Pass when `published` is false.
- [ ] Lane 7. Student JWT cannot read that grade. Save `pr-03-hidden.png`. Pass when select is empty.
- [ ] Lane 8. `lms_publish_grade` then student can read it. Save `pr-03-publish.png`. Pass when the score is visible.
- [ ] Lane 9. Token scoped to course A calling create on course B. Save `pr-03-scope.png`. Pass when the tool returns an error.
- [ ] Lane 10. `lms_post_announcement` then a row exists for that course. Save `pr-03-announce.png`. Pass when the student notification or announcement table has the row. Also confirm `mcp_audit_log` has the write.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. `tools/list` latency and `lms_get_course` latency at trunk and head.
- [ ] Probe. `curl` both methods 20 times interleaved on trunk and head.
- [ ] Baseline. Record trunk `lms_get_course` p50 first.
- [ ] Rule. Head `lms_get_course` p50 may not exceed trunk by more than 20 percent. `tools/list` p50 must stay under 500ms.

**Review gate.** None. PR-03 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [x] Root appends it to the stack. The operator lands it.

## Ship student Canvas views (PR-04)

**Depends on.** PR-02.

**Files.**

- [x] Edit `app/[locale]/dashboard/student/courses/[courseId]/page.tsx`.
- [x] Create assignment, grades, and calendar routes under `app/[locale]/dashboard/student/`.
- [x] Create student submit actions that use the session Supabase client.

**Build.**

- [x] Course home, assignment detail with submit, published grades, calendar from `course_calendar_items`.

**You see.**

- [x] Seeded student can submit text to an assignment and see a published grade only after publish.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [x] Playwright or Vitest for submit and unpublished-hidden. Run `npm run test:unit` plus a focused Playwright file if added.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open student course home on trunk and head. Save `pr-04-home.png`. Pass when lessons still list on head.
- [ ] Lane 2. Open assignments list. Save `pr-04-list.png`. Pass when the titled assignment appears.
- [ ] Lane 3. Open assignment detail. Save `pr-04-detail.png`. Pass when body and due date render.
- [ ] Lane 4. Submit text before due. Save `pr-04-submit.png`. Pass when submitted state shows.
- [ ] Lane 5. Submit after reject-late due. Save `pr-04-late.png`. Pass when an error is shown and no new submitted row.
- [ ] Lane 6. Grades page with a draft grade. Save `pr-04-pending.png`. Pass when the score is not shown.
- [ ] Lane 7. Grades page after publish. Save `pr-04-grade.png`. Pass when the score is shown.
- [ ] Lane 8. Calendar page. Save `pr-04-cal.png`. Pass when assignment and exam rows appear.
- [ ] Lane 9. Unenrolled user hits the assignment URL. Save `pr-04-guard.png`. Pass when notFound or redirect, not the body.
- [ ] Lane 10. Mobile viewport 390px wide on course home. Save `pr-04-mobile.png`. Pass when nav and assignment list are usable without overlap.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time to course home interactive at trunk and head. Assignment list query time on head.
- [ ] Probe. Control-ui or Playwright navigation timing on trunk course home then head course home, interleaved. `explain analyze` the assignment list query on head.
- [ ] Baseline. Record trunk course-home load ms first.
- [ ] Rule. Head course home may not exceed trunk by more than 20 percent. Assignment list query under 100ms on seed data.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2 screenshots into `/tmp/media/pr-04-review-list.png`.
- [ ] Record a 30 to 60 second video of submit then grades on a lane VM. Save it as `/tmp/media/pr-04-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [x] Root appends it to the stack. The operator lands it.

## Bind professor bots in admin (PR-05)

**Depends on.** PR-03.

**Files.**

- [x] Edit `app/[locale]/dashboard/teacher/api-tokens/page.tsx` and admin twin.
- [x] Edit `app/actions/mcp-tokens.ts` and `components/dashboard/api-tokens-page`.
- [x] Edit course settings and admin settings for bots and `auto_publish_grades`.

**Build.**

- [x] Paste block for `/api/mcp`. Course-scoped professor token. Bot prompt fields. Auto-publish toggle.

**You see.**

- [x] Admin copies URL `https://<domain>/api/mcp` and a one-time token. Toggle off keeps MCP grades unpublished.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [x] Action tests that createToken persists `course_ids` and never logs the raw token. Run `npm run test:unit`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open teacher API token page on trunk and head. Save `pr-05-tokens.png`. Pass when the page still loads.
- [ ] Lane 2. Create a professor token scoped to one course. Save `pr-05-create.png`. Pass when the raw token is shown once.
- [ ] Lane 3. Reload the token page. Save `pr-05-reload.png`. Pass when the raw token is gone.
- [ ] Lane 4. Copied URL has no `/cli` suffix on a single-school domain, or `/cli` still works as alias. Save `pr-05-url.png`. Pass when `curl` with that URL and token lists tools.
- [ ] Lane 5. Save a professor bot on the course. Save `pr-05-bot.png`. Pass when `course_professor_bots` has the prompt.
- [ ] Lane 6. Auto-publish off, MCP grade, student grades page. Save `pr-05-off.png`. Pass when pending, not a number.
- [ ] Lane 7. Auto-publish on, MCP grade, student grades page. Save `pr-05-on.png`. Pass when the number shows.
- [ ] Lane 8. Token for course A used on course B. Save `pr-05-scope.png`. Pass when denied.
- [ ] Lane 9. Student cannot open the token page. Save `pr-05-student.png`. Pass when redirect or 403.
- [ ] Lane 10. Admin settings persist auto-publish across reload. Save `pr-05-persist.png`. Pass when the toggle stays.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Token page load at trunk and head. Token create action time on head.
- [ ] Probe. Open the token page on trunk then head, interleaved. Time `createMcpToken` on head.
- [ ] Baseline. Record trunk token-page load ms first.
- [ ] Rule. Head token page may not exceed trunk by more than 20 percent. Create action under 500ms excluding network to Supabase.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2 screenshots into `/tmp/media/pr-05-review-create.png`.
- [ ] Record a 30 to 60 second video of token create and auto-publish toggle on a lane VM. Save it as `/tmp/media/pr-05-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [x] Root appends it to the stack. The operator lands it.

## Disable then delete commerce (PR-01)

**Depends on.** PR-04 and PR-05.

**Files.**

- [x] Edit student, teacher, and admin nav to drop commerce links.
- [x] Delete or redirect `app/[locale]/platform/**` and payment dashboards after grep is clean.
- [x] Edit `mcp-server/index.ts` to stop registering landing-page tools when those files go.

**Build.**

- [x] Follow `docs/plans/01-strip-saas.md`. Disable first. Delete only with typecheck green.

**You see.**

- [x] Student shell has no store. Admin shell has no payouts. Login still works.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [x] `npm run typecheck`. Drop or rewrite tests that targeted checkout. Run `npm run test:unit`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Login and open student home on trunk and head. Save `pr-01-home.png`. Pass when student home still loads.
- [ ] Lane 2. Student nav has no store or payments. Save `pr-01-nav.png`. Pass when those links are absent.
- [ ] Lane 3. `/dashboard/student/store` redirects or 404s. Save `pr-01-store.png`. Pass when the store UI is gone.
- [ ] Lane 4. Admin payouts URL. Save `pr-01-payouts.png`. Pass when the payouts UI is gone.
- [ ] Lane 5. Platform billing URL. Save `pr-01-platform.png`. Pass when it is not a live billing console.
- [ ] Lane 6. Assignment submit still works. Save `pr-01-submit.png`. Pass when a submission saves.
- [ ] Lane 7. MCP token page still loads. Save `pr-01-mcp.png`. Pass when the paste URL is visible.
- [ ] Lane 8. `lms_get_course` still works. Save `pr-01-mcp-course.png`. Pass when the tool returns the course.
- [ ] Lane 9. Seeded login `owner@e2etest.com` still enters the admin shell. Save `pr-01-admin.png`. Pass when users or settings render.
- [ ] Lane 10. `npm run build` on the lane VM. Save `pr-01-build.png`. Pass when the build exits 0.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. `next build` time and student home TTFB at trunk and head.
- [ ] Probe. `time npm run build` on trunk then head, interleaved. Course home TTFB on both.
- [ ] Baseline. Record trunk build seconds first.
- [ ] Rule. Head build may be faster. Fail if head build is more than 20 percent slower than trunk, or if student home TTFB exceeds trunk by more than 20 percent.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2 screenshots into `/tmp/media/pr-01-review-nav.png`.
- [ ] Record a 30 to 60 second video of student nav plus an assignment submit on a lane VM. Save it as `/tmp/media/pr-01-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [x] Root appends it to the stack. The operator lands it.

## Rewrite the self-host README (PR-06)

**Depends on.** PR-00. Retarget after PR-01.

**Files.**

- [x] Edit `README.md`.
- [x] Edit `.env.example` comments if PR-01 did not already.

**Build.**

- [x] Short self-host plus Grok MCP paste. Credit lms-front. No marketing site.

**You see.**

- [x] README clone commands use `boteducation`. Grok section names `/api/mcp`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [x] `rg -n "Stripe Connect" README.md` is empty or only a historical credit. Save the rg output.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Follow README clone plus `npm install` on trunk (lms-front README) and head. Save `pr-06-install.png`. Pass when head install still exits 0.
- [ ] Lane 2. README names BotEducation. Save `pr-06-title.png`. Pass when the H1 is BotEducation.
- [ ] Lane 3. README credits lms-front. Save `pr-06-credit.png`. Pass when the upstream URL is present.
- [ ] Lane 4. README MCP URL is `/api/mcp`. Save `pr-06-mcp-url.png`. Pass when `/cli` is not the only URL.
- [ ] Lane 5. README does not sell subdomains as the product. Save `pr-06-saas.png`. Pass when the pitch is one school.
- [ ] Lane 6. `.env.example` has no raw secrets. Save `pr-06-env.png`. Pass when values are empty or placeholders.
- [ ] Lane 7. Seeded login instructions remain for local Docker. Save `pr-06-seed.png`. Pass when `password123` is marked local-dev.
- [ ] Lane 8. LICENSE is still MIT. Save `pr-06-license.png`. Pass when LICENSE still says MIT.
- [ ] Lane 9. `docs/plans/03-mcp-professor.md` is linked from README. Save `pr-06-link.png`. Pass when the relative link exists.
- [ ] Lane 10. Open login after following README env on a Docker lane. Save `pr-06-follow.png`. Pass when the login form renders.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. README byte size and `npm install` time at trunk and head.
- [ ] Probe. `wc -c README.md` and `time npm install` on trunk then head, interleaved.
- [ ] Baseline. Record trunk `npm install` seconds first (cache-aware, same machine).
- [ ] Rule. Head `npm install` may not exceed trunk by more than 20 percent. README must stay under 40k bytes.

**Review gate.** None. PR-06 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [x] Root appends it to the stack. The operator lands it.

## Close the program

- [ ] Every box above is checked with its evidence.
- [ ] Reply to the operator with the stack root and tip links, a one-line verdict per PR, and anything parked.

## Appendix A. Prototype evidence

No throwaway prototype branch. Open questions were observational.

Settled by clone and commands in this session.

- `npm install` works at `33f32ada` on Node v22.14.0. Evidence is the npm audit footer in the session log.
- `npm run typecheck` exits 0. Evidence is the tsc run in this session.
- Docker is missing. `command -v docker` failed. Local `supabase start` is blocked.
- `gh` has no token. The GitHub fork URL does not exist yet.
- `assignments`, `submissions`, and `grades` exist in `supabase/migrations/20260126190500_lms_complete.sql` and in `lib/database.types.ts`. No app `.from('assignments')` callers. `grades_submission_id_fkey` points at `exam_submissions`. Assignment SELECT is `USING (true)`.
- MCP already has `lms_get_course`, `lms_create_lesson`, `lms_create_exam`, exam `lms_grade_submission`, and roster-like `lms_list_enrollments`. About 91 live tools. PAT CLI does not mint a user JWT.

Unproven until operator go.

- Which GitHub account owns the fork, `ejflow` or `MrF1ow`.
- Whether a Docker-capable VM can complete `db:reset` without seed failures.

## Appendix B. Alternatives rejected

Replace `assignments` with new tables. Rejected because types, FKs, and staff RLS already use those names. Extend `assignments` and `submissions`. Retarget `grades` off `exam_submissions` instead of pretending that FK is homework.

Rename `teacher` to `professor` in Postgres in PR-02. Rejected because JWT hooks, RLS, and MCP guards all read `teacher`. Alias at the product boundary.

Delete commerce in PR-00. Rejected because typecheck and tenant login still depend on that tree. User order is happy path first.

Build a Grok chat UI. Rejected. The product is a stable MCP endpoint.

A second protocol beside MCP. Rejected. Extend `mcp-server/src/tools`.

`course_announcements` as a new table before inspecting `notifications`. Prefer reuse. Add a table only if targeting cannot stay in-app and course-scoped.

## Appendix C. Risks

- No `GH_TOKEN` in this cloud run. PR-00 cannot push until the operator adds GitHub auth. Owner watches `git remote -v`.
- No Docker. Live lanes that need `db:reset` must run on VMs with Docker. Owner watches boot recipe failures.
- `control-ui` is not in this repo. Lanes fall back to Playwright. Named in the boot recipe.
- `pstack/` is not in this repo. `git show origin/main:pstack/...` will fail until those skills are vendored or the owner reads them from the Cursor plugin cache. Owner watches the arm step.
- Enrollment product columns were already dropped. Owner still watches free roster inserts in PR-02.
- `lms_grade_submission` is an exam tool. Do not reuse the name for assignments. PR-03.
- Service-role audit vs user-scoped writes. Professor tokens must not use service role for assignment writes. PR-03.
- PAT `/cli` forwards `X-User-*` and no user JWT. `LmsSession` will reject Grok until PR-03 mints a user token. Owner watches PAT `lms_get_course`.
- `createAdminClient` on the current student course page. PR-04 must not copy it for submits.
- Forking the wrong GitHub user. Operator choice before `gh repo fork`.
- Student home imports weekly league and gamification. PR-01 must edit those pages in the same commit as the component delete.
- i18n and `proxy.ts` tenancy are request-path. PR-01 does not delete them.

## Appendix D. Links and reading list

- Upstream [guillermoscript/lms-front](https://github.com/guillermoscript/lms-front)
- `docs/GETTING_STARTED.md`, `docs/MCP_SETUP.md`, `docs/AUTH.md`
- `mcp-server/src/tools/`, `mcp-server/src/audit.ts`, `app/api/mcp/[[...path]]/route.ts`
- `supabase/migrations/20260126190500_lms_complete.sql` (legacy assignment tables)
- `supabase/migrations/20260214140159_create_mcp_api_tokens.sql`
- `supabase/migrations/20260830140000_rls_tenant_scope_sweep.sql`
- PR-02 and PR-03 get `pstack/skills/how/SKILL.md` and `pstack/skills/interrogate/SKILL.md` before implementation.
- Trail per `pstack/skills/show-me-your-work/SKILL.md` in each owner's `decisions.tsv`.
