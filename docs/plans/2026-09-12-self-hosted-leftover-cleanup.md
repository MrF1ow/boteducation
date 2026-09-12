# Self-hosted leftover cleanup plan

This program removes leftover SaaS billing, community, and student paywall wiring from BotEducation. One school per deploy. Teachers create courses without a Free cap. Students browse this tenant's published courses and enroll without a school-sold subscription. Community leaves the product. Keep `entitlements` and `enrollments`. Run PR-01, PR-02, PR-03, then PR-04.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-stack.md`. The operator lands the stack. PR-01, PR-02, and PR-03 wait at merge-ready for her review. PR-04 is not review-gated.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on her explicit go.
- [ ] On her go, arm a `/goal` with this exact text. "docs/plans/2026-09-12-self-hosted-leftover-cleanup.md. PR-01 then PR-02 then PR-03 then PR-04. Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. The operator lands the stack. Done when a tenant member creates a sixth course, enrolls from Browse without a subscription, sees no Community nav, and never hits a `/pricing` bounce."
- [ ] Read these from trunk at program start. Re-read them at every tick.
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-stack.md`
  - [ ] `git show origin/main:pstack/skills/swarm/SKILL.md`
  - [ ] `git show origin/main:.claude/skills/agent-browser/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/opening-a-pr.md`
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/shipping.md`
- [ ] Arm the 30-minute audit tick. In a local session, a real terminal `/loop`. In a cloud root, a cloud-sleeper wake chain. Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the execution playbook from trunk and the armed /goal. Audit the operation against both and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then send the operator a status message, whether or not anything changed, with the queue table of PR, owner, state, and head SHA, the verdicts since the last tick, what merged, open operator gates, and blockers."
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once.
- [ ] This repo's trunk is `origin/master`, not `origin/main`. Fetch and rebase against `origin/master`. Keep the `origin/main:` playbook lines above as the required markers.

### Spawn owners

- [ ] Spawn one owner per PR with the full lifecycle the execution playbook names.
- [ ] Follow this dependency graph. Start dependent work only after its parent merges, or base it on the parent branch when the execution playbook stacks.
  - [ ] PR-01 branches from `master`.
  - [ ] PR-02 after PR-01.
  - [ ] PR-03 after PR-01. It may stack beside PR-02 if file boundaries hold.
  - [ ] PR-04 after PR-02 and PR-03.
- [ ] Hold the file boundaries. PR-01 owns plan limits, cutoff, and feature gates. PR-02 owns Browse, enroll RPCs, and dead `/pricing` plus `/courses` links in live dashboard UI. PR-03 owns community. PR-04 owns dead public routes, unused SaaS components, and docs.
- [ ] Hold the review gate. PR-01, PR-02, and PR-03 change an interaction. They wait for the operator's review in chat with screenshots and a video before merge.

### PR mechanics, for every PR

- [ ] Resolve the forge once. Default to `gh`; if `command -v origin` succeeds and Origin can resolve the repository, use `origin pr` for every PR operation. Record any fallback to `gh`. Never require `gt`.
- [ ] Open the PR ready, never draft, with `origin pr create --status open --base <base-branch>` or `gh pr create --base <base-branch>` according to the resolved forge. A stack child targets its parent branch.
- [ ] Run the repo's lint and typecheck once before the PR-facing push. Push with hooks on.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment per `../references/bugbot-triage.md`.
- [ ] Rebase onto current trunk before babysit and again before the merge-ready report.

### Verdict and merge, for every PR

- [ ] At the merge-ready head SHA, run the swarm per `pstack/skills/swarm/SKILL.md`. One gates lane. The ten live lanes from the PR's **Verify, live** block. The perf lane from its **Verify, perf** block. One audit lane that reads the diff and the receipts and distrusts the PR body.
- [ ] Clean only when every lane is `PASS`. Findings go back to the owner. A new head gets a fresh swarm and a fresh verdict.
- [ ] No owner merges, arms auto-merge, or closes. The root appends the PR to the one linear base-branch stack after a clean verdict. The operator lands the chain bottom-up. Preserve patch-id across rebases per `playbooks/shipping.md`.

### Boot recipe, for every live lane

Each live lane runs on its own cloud VM at the PR head. Drive through `.claude/skills/agent-browser/SKILL.md`. This repo has no `control-ui` skill. Use the `computerUse` subagent when `agent-browser` cannot reach `http://lvh.me:3000`.

- [ ] `git fetch origin <head-branch> && git checkout <head SHA>`.
- [ ] Confirm `/tmp/cursor/start-user/start-user.status` or `scripts/cloud-agent-start.sh` left Next on port 3000 and local Supabase up. Open `http://lvh.me:3000`, never `localhost`.
- [ ] Log in only through the browser. Seeded accounts are `student@e2etest.com` / `password123` on Default School and `owner@e2etest.com` / `password123` for admin. Code Academy uses `http://code-academy.lvh.me:3000` with `creator@codeacademy.com` / `password123`.
- [ ] Save every screenshot to `/tmp/swarm-<pr-id>/worker-<n>/<slug>.png` and return the paths with the report.

## Disarm platform plan limits (PR-01)

**Depends on.** None.

**Files.**

- [ ] Create `supabase/migrations/<timestamp>_drop_plan_limit_triggers.sql`. Drop `enforce_course_plan_limit` and `enforce_student_plan_limit`. Drop or no-op `get_tenant_plan_usage` if nothing live still needs it. Clear `tenants.access_cutoff_at` for every row.
- [ ] Edit `lib/billing/plan-limits.ts`, `lib/billing/plan-limit-error.ts`, and `lib/billing/access-cutoff.ts` so app code cannot schedule cutoff or refuse creates.
- [ ] Delete `app/api/cron/enforce-plan-limits/route.ts` or make it a no-op that returns 204 without writing cutoff.
- [ ] Edit `app/actions/teacher/courses.ts`, `app/actions/admin/courses.ts`, `app/actions/admin/ai-course.ts`, `app/actions/admin/products.ts`, and `app/actions/join-school.ts`. Remove `checkCourseLimit` and student-cap refusals.
- [ ] Edit `mcp-server/src/plan-limits.ts` so MCP course and member writes no longer read Free caps.
- [ ] Edit `app/[locale]/layout.tsx`. Pass tenant colors through without `hasPlanFeature(..., 'custom_branding')`.
- [ ] Edit `app/actions/admin/settings.ts` and `app/actions/admin/theme.ts`. Remove `refuseBrandingBelowPlan` and `requirePlanFeature(..., 'custom_branding')`.
- [ ] Edit `app/actions/exam-grading.ts` and checkpoint grading callers. Remove `ai_grading` gates.
- [ ] Edit `app/actions/cloudflare.ts`. Remove the `custom_domain` gate or keep Cloudflare errors that are real DNS failures only.
- [ ] Edit teacher and admin analytics pages. Remove `UpgradeNudge` and analytics-tier refusals.
- [ ] Edit `components/teacher/course-form.tsx`. Remove the cap screen and the `/pricing` button.
- [ ] Edit `app/[locale]/dashboard/admin/page.tsx`. Remove plan name, usage meters, and upgrade copy.
- [ ] Edit `components/shared/access-cutoff-banner.tsx` and `app/[locale]/dashboard/student/access-suspended/page.tsx`. Stop rendering cutoff as a live lock, or delete them if nothing else imports them.
- [ ] Edit `tests/unit/plan-feature-gate-contract.test.ts` so it no longer requires SaaS gates. Delete or rewrite `tests/playwright/plan-limit-surfaces.spec.ts`, `tests/playwright/access-cutoff-lifecycle.spec.ts`, `tests/playwright/plan-feature-tiers.spec.ts`, and `tests/playwright/utils/plan-gate-fixtures.ts`.
- [ ] Leave `entitlements`, `enrollments`, `plans`, `plan_courses`, and `subscriptions` tables in place.

**Build.**

- [ ] A sixth `courses` insert for Default School succeeds from the teacher form, from `app/actions/teacher/courses.ts`, and from MCP. The database no longer raises SQLSTATE LM001. Branding CSS variables render on Free. Cutoff cron does not write `access_cutoff_at`.

**You see.**

- [ ] Owner on `http://lvh.me:3000` opens course create, saves a sixth course, and lands on the course editor. The form has no Upgrade Plan button. Admin home has no Free usage meter. Settings colors appear on the next full page load.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `tests/unit/plan-feature-gate-contract.test.ts` no longer claims page-level community checks or SaaS `requirePlanFeature` sites that this PR removed. Run `npx vitest run tests/unit/plan-feature-gate-contract.test.ts`.
- [ ] Playwright plan-limit and access-cutoff specs are deleted or rewritten so they do not recreate Free caps. Run `npx playwright test tests/playwright/tenant-isolation.spec.ts` to prove tenant scoping still holds.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. On trunk, as owner, open teacher course create after Default School already has five published or draft courses and record the cap screen. On head, create a sixth course named `PR01 sixth course`. Save `pr01-regression-sixth-course.png`. Pass when trunk shows the cap or an LM001 mapped error, and head shows the saved course with no `/pricing` button.
- [ ] Lane 2. As owner, open admin appearance, set a primary color, save, hard-reload a dashboard page. Save `pr01-branding-applies.png`. Pass when the primary button color matches the saved value.
- [ ] Lane 3. As owner, open `/en/dashboard/admin/analytics`. Save `pr01-admin-analytics.png`. Pass when the page renders charts or an empty analytics state and no UpgradeNudge.
- [ ] Lane 4. As creator on `http://code-academy.lvh.me:3000`, open a course analytics page. Save `pr01-teacher-analytics.png`. Pass when analytics is visible and no upgrade lock covers it.
- [ ] Lane 5. As owner, open admin home. Save `pr01-admin-home-no-meter.png`. Pass when the page has no plan slug, no 5/50 student meter, and no upgrade CTA.
- [ ] Lane 6. As student, open an enrolled course lesson. Save `pr01-student-no-cutoff.png`. Pass when the lesson renders and the URL is not `/access-suspended`.
- [ ] Lane 7. As owner, open teacher course create on a tenant under five courses. Save `pr01-course-form-idle.png`. Pass when the form fields are enabled and the Upgrade Plan link is absent.
- [ ] Lane 8. Trigger or inspect `GET /api/cron/enforce-plan-limits` with the cron secret if the route still exists. Save `pr01-cron-noop.png` or the response body log. Pass when the handler does not set `access_cutoff_at` on Default School.
- [ ] Lane 9. As owner, change the school name in settings and save. Save `pr01-settings-still-save.png`. Pass when the name persists. Branding fields save without a plan error toast.
- [ ] Lane 10. As owner, archive and restore a course, or create then delete a draft. Save `pr01-course-lifecycle.png`. Pass when ordinary course CRUD still works after the trigger drop.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from submitting the course-create form to the course editor heading, measured at trunk when under the cap and at head for a sixth course. Also record time from login to admin home first paint at both sides.
- [ ] Probe. Interleave trunk then head. Same owner account. Stopwatch from the click to the heading in the DOM snapshot.
- [ ] Baseline. Record the trunk create time first, then trunk admin-home time.
- [ ] Rule. Head create may not exceed trunk create by more than 1500 ms. Head admin home may not exceed trunk by more than 800 ms. A sixth-course create on head must finish within 5000 ms even though trunk cannot perform that create.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 1, 2, and 5 screenshots into `/opt/cursor/artifacts/pr-01-review-sixth.png`, `/opt/cursor/artifacts/pr-01-review-branding.png`, and `/opt/cursor/artifacts/pr-01-review-admin-home.png`.
- [ ] Record a 30 to 60 second video of sixth-course create plus a branding reload on a lane VM. Save it as `/opt/cursor/artifacts/pr-01-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The root appends PR-01 as the stack base targeting `master`. The operator lands it.

## Replace the browse paywall with membership enroll (PR-02)

**Depends on.** PR-01.

**Files.**

- [ ] Create `supabase/migrations/<timestamp>_membership_self_enroll.sql`. Add `self_enroll_school_course(_course_id integer)` or replace `self_enroll_subscription_course` so a tenant member may enroll in a published course of that tenant without a `subscriptions` row. Keep writing `entitlements` and `enrollments`. Refuse other tenants. Refuse unpublished courses.
- [ ] Edit `lib/hooks/use-enrollment.ts` and `mcp-server/src/tools/enroll.ts` to call the new RPC.
- [ ] Edit `app/[locale]/dashboard/student/browse/page.tsx` and `components/student/browse-course-card.tsx`. Drop subscription alerts, `not-in-plan`, `no-subscription`, and every `/pricing` link. Cards are enrolled or enrollable for published tenant courses.
- [ ] Edit `app/[locale]/dashboard/student/page.tsx`, `app/[locale]/dashboard/student/courses/page.tsx`, and `app/[locale]/dashboard/student/profile/page.tsx`. Remove Current Plan copy and `/pricing` or `/courses` empty-state links. Point empty states at `/dashboard/student/browse`.
- [ ] Edit `components/app-sidebar.tsx`. Remove the nested Course Catalog item that targets `/courses`. Keep Browse on the dashboard browse route.
- [ ] Move live helpers out of `app/[locale]/(public)/checkout/actions.ts` if PR-04 will delete that tree and a live importer still needs them. Prefer deleting `changePlan` and public enroll buttons if this PR already removed their importers.
- [ ] Unify `lib/auth/retired-marketing-path.ts` and `COMMERCE_GONE_PATHS` in `next.config.ts` so `/courses` and `/pricing` stay retired for everyone.
- [ ] Rewrite Playwright browse and enrollment specs that still expect a subscription wall. Keep `tests/playwright/tenant-isolation.spec.ts` assertions that Default School cannot see Code Academy titles.
- [ ] Do not add a bookmark or save table. Catalog stays `courses.tenant_id` plus `status = published`.

**Build.**

- [ ] A Default School student with no `subscriptions` row opens Browse, sees only Default School published courses, clicks Enroll, and then opens the course. The RPC does not mention payment. Sidebar has no `/courses` entry.

**You see.**

- [ ] `student@e2etest.com` on Browse sees tenant courses with Enroll or Continue. Locked paywall cards are gone. Profile has no Manage Subscription button. Visiting `/en/pricing` still does not show a storefront.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add or rewrite a unit test for the enroll hook or RPC error mapping so a missing subscription is no longer a user-facing failure. Run `npx vitest run tests/unit`.
- [ ] `tests/unit/commerce-nav-disable.test.ts` still asserts store and billing nav stay gone. Run `npx vitest run tests/unit/commerce-nav-disable.test.ts`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. As student, open Browse at trunk and at head. Save `pr02-regression-browse.png`. Pass when trunk still shows a plan or pricing lock on at least one card or banner, and head shows Enroll or Continue with no `/pricing` link.
- [ ] Lane 2. As student, enroll in a published course that is not yet in My Courses. Save `pr02-enroll-success.png`. Pass when the card flips to Continue and the course page loads content.
- [ ] Lane 3. As student, open My Courses empty or populated. Save `pr02-my-courses.png`. Pass when empty copy links to dashboard Browse, not `/courses` or `/pricing`.
- [ ] Lane 4. As student, open Profile. Save `pr02-profile-no-plan.png`. Pass when there is no Current Plan card and no Manage Subscription control.
- [ ] Lane 5. As student, open the sidebar Browse group. Save `pr02-sidebar-no-public-catalog.png`. Pass when Course Catalog `/courses` is absent and dashboard Browse remains.
- [ ] Lane 6. As student, open `http://lvh.me:3000/en/pricing` and `http://lvh.me:3000/en/courses`. Save `pr02-retired-paths.png`. Pass when both land on the student dashboard, not a catalog or checkout.
- [ ] Lane 7. As student on Default School, confirm no Code Academy title such as Python for Beginners appears in Browse. Save `pr02-tenant-scope.png`. Pass when that title is absent.
- [ ] Lane 8. As alice on `http://code-academy.lvh.me:3000`, open Browse. Save `pr02-other-tenant-browse.png`. Pass when the list is Code Academy published courses only, and enroll works without a pricing lock.
- [ ] Lane 9. As student, click Enroll twice on the same course. Save `pr02-enroll-idempotent.png`. Pass when the second click stays enrolled and does not error as a payment failure.
- [ ] Lane 10. As owner, publish a new course then view it as student on Browse. Save `pr02-new-publish-appears.png`. Pass when the new course is enrollable on the same tenant and still absent on the other tenant.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from Browse navigation to first course card text, at trunk and head. Time from Enroll click to Continue label at head. Trunk enroll may fail because of the paywall. Record that and keep an absolute enroll budget on head.
- [ ] Probe. Interleave trunk Browse load, head Browse load, then head Enroll. Same student session cookies per side.
- [ ] Baseline. Record trunk Browse load first.
- [ ] Rule. Head Browse load may not exceed trunk by more than 800 ms. Head Enroll must reach Continue within 3000 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 1, 2, and 7 screenshots into `/opt/cursor/artifacts/pr-02-review-browse.png`, `/opt/cursor/artifacts/pr-02-review-enroll.png`, and `/opt/cursor/artifacts/pr-02-review-scope.png`.
- [ ] Record a 30 to 60 second video of Browse enroll on Default School on a lane VM. Save it as `/opt/cursor/artifacts/pr-02-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The root appends PR-02 onto PR-01. The operator lands it after PR-01.

## Delete community (PR-03)

**Depends on.** PR-01.

**Files.**

- [ ] Delete dashboard community pages under `app/[locale]/dashboard/{student,teacher,admin}/community/` and the two `courses/[courseId]/community/` pages.
- [ ] Delete `app/actions/community.ts` and `app/actions/admin/community.ts`.
- [ ] Delete `components/community/`.
- [ ] Edit `components/app-sidebar.tsx`. Remove Community items for all three roles.
- [ ] Edit `lib/plans/features.ts` and the contract test. Remove the `community` key and the `ENFORCED_ELSEWHERE` allowlist row if they still exist after PR-01.
- [ ] Create `supabase/migrations/<timestamp>_drop_community.sql`. Drop `community_posts`, `community_reactions`, `community_poll_options`, `community_poll_votes`, `community_flags`, `community_user_mutes`, and related policies. Do not drop lesson comment tables.
- [ ] Delete `tests/playwright/community.spec.ts` and `tests/playwright/community-interactions.spec.ts`. Remove community rows from smoke tests.
- [ ] Edit `messages/en.json` and `messages/es.json`. Remove community nav strings that would now be unused.
- [ ] Edit `docs/COMMUNITY_SPACES.md` into a tombstone or delete it in PR-04 if this PR already has a docs touch. Prefer a one-line pointer in this PR so searchers do not treat the doc as live.
- [ ] Grep `mcp-server/src` for community tools. None exist today. Confirm still none.

**Build.**

- [ ] No Community sidebar entry. Direct community URLs 404 or redirect to the role dashboard. Lesson comments on a lesson page still load. `createPost` is not an exported server action.

**You see.**

- [ ] Student, teacher, and admin sidebars have no Community item. `/en/dashboard/student/community` does not render a feed. A lesson comments thread still accepts a comment.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `rg "createPost|CommunityFeed|dashboard/.*/community" --glob '!supabase/migrations/**'` returns only the drop migration and docs tombstone. Run that ripgrep from the repo root.
- [ ] Unit tests that imported community actions are gone. Run `npm run test:unit`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. As student, open the sidebar at trunk and at head. Save `pr03-regression-nav.png`. Pass when trunk shows Community and head does not.
- [ ] Lane 2. As student, visit `/en/dashboard/student/community`. Save `pr03-student-community-url.png`. Pass when the response is 404 or a dashboard redirect, not a feed.
- [ ] Lane 3. As owner, visit `/en/dashboard/admin/community` and the moderation path. Save `pr03-admin-community-url.png`. Pass when no moderation feed renders.
- [ ] Lane 4. As creator, visit teacher community and a course community URL. Save `pr03-teacher-community-url.png`. Pass when neither renders a feed.
- [ ] Lane 5. As student, open a lesson that has comments and add one comment. Save `pr03-lesson-comments-live.png`. Pass when the comment appears. This is not community.
- [ ] Lane 6. As student, walk Home, Browse, My Courses, Profile. Save `pr03-student-nav-intact.png`. Pass when those items still navigate and none 404.
- [ ] Lane 7. As owner, walk admin home, courses, settings. Save `pr03-admin-nav-intact.png`. Pass when those items still navigate and Community is absent.
- [ ] Lane 8. Repeat lane 1 on `http://lvh.me:3000/es/dashboard/student`. Save `pr03-es-nav.png`. Pass when the Spanish sidebar also has no Community item.
- [ ] Lane 9. As student, submit a POST to the old community action path if Next still exposes it, or record that the module is gone. Save `pr03-action-gone.png` or the 404 body. Pass when a post cannot be created.
- [ ] Lane 10. As owner, delete a course. Save `pr03-course-delete.png`. Pass when course delete still succeeds after community tables are dropped.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from login to student sidebar first nav text, trunk and head.
- [ ] Probe. Interleave trunk login and head login with the student account.
- [ ] Baseline. Record trunk login-to-sidebar first.
- [ ] Rule. Head may not exceed trunk by more than 500 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 1, 2, and 5 screenshots into `/opt/cursor/artifacts/pr-03-review-nav.png`, `/opt/cursor/artifacts/pr-03-review-url.png`, and `/opt/cursor/artifacts/pr-03-review-lesson-comments.png`.
- [ ] Record a 30 to 60 second video of sidebar plus a lesson comment on a lane VM. Save it as `/opt/cursor/artifacts/pr-03-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The root appends PR-03 onto the stack after PR-01, beside or after PR-02 if files collide. The operator lands it after its parent.

## Remove dead SaaS code and docs (PR-04)

**Depends on.** PR-02 and PR-03.

**Files.**

- [ ] Delete or fully retire `app/[locale]/(public)/` once `checkout/actions.ts` has no live importers. Delete `components/public/footer.tsx`, `components/public/powered-by-banner.tsx`, and unused public enroll or plan buttons.
- [ ] Delete unused `components/shared/feature-gate.tsx`, `lib/hooks/use-plan-features.ts`, `components/admin/billing-overview.tsx`, and `components/admin/plan-change-dialog.tsx` if they still have zero app importers.
- [ ] Edit `proxy.ts` so `/platform` no longer pays for `checkSuperAdmin()` if those routes stay gone. Keep super-admin only if a live operator console remains.
- [ ] Edit `PRODUCT.md`, `CLAUDE.md`, `docs/MONETIZATION.md`, and `docs/AI_AGENT_GUIDE.md` so they describe a self-hosted school, not platform billing.
- [ ] Edit `supabase/seed.sql` comments that say Default School stays on Free on purpose for gate E2E, if those specs are gone.
- [ ] Grep for `/pricing`, `UpgradeNudge`, `requirePlanFeature`, and `get_plan_features` in `app/` and `components/`. Leave only justified leftovers listed in the PR body.

**Build.**

- [ ] `rg "/pricing" app components` has no live dashboard CTA. Public marketing routes stay retired. Docs no longer tell an operator to open BillingOverview.

**You see.**

- [ ] Dashboard flows from PR-02 and PR-03 still work. No new user-visible screen appears. Dead files are gone from the tree.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `npm run typecheck` and `npm run test:unit` pass after the deletions.
- [ ] `npm run lint` passes on the deleted-import set.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. As student, load Home at trunk and head. Save `pr04-regression-home.png`. Pass when head still shows the student home from PR-02, and trunk vs head differ only by leftover SaaS chrome already removed in earlier PRs or still present on trunk.
- [ ] Lane 2. As student, Browse enroll still works. Save `pr04-browse-still-enrolls.png`. Pass when Enroll or Continue is present.
- [ ] Lane 3. As owner, create a course. Save `pr04-course-create-still-works.png`. Pass when create succeeds.
- [ ] Lane 4. Visit `/en`, `/en/pricing`, `/en/checkout`, `/en/creators`. Save `pr04-public-retired.png`. Pass when none render a storefront.
- [ ] Lane 5. As owner, open `/en/platform` if the host allows it. Save `pr04-platform-gone.png`. Pass when it is retired or 404, not a billing console.
- [ ] Lane 6. As owner, open admin settings. Save `pr04-settings.png`. Pass when settings save without a billing subsection that links to a dead page.
- [ ] Lane 7. As student, open a lesson comment thread. Save `pr04-lesson-comments.png`. Pass when comments still work.
- [ ] Lane 8. As creator on Code Academy, open teacher home. Save `pr04-second-tenant.png`. Pass when that tenant still loads after public-route deletion.
- [ ] Lane 9. Check the browser console on student Browse for failed chunks from deleted public components. Save `pr04-no-chunk-errors.png`. Pass when there is no failed fetch for deleted JS.
- [ ] Lane 10. As owner, log out and hit `http://lvh.me:3000/en`. Save `pr04-anon-landing.png`. Pass when the anonymous visitor is sent to login, matching current `proxy.ts` behavior.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from anonymous `/en` to the login form heading, trunk and head. Time from student login to Browse first card, trunk-of-stack (PR-03 head) and PR-04 head.
- [ ] Probe. Interleave the two URLs on trunk then head.
- [ ] Baseline. Record trunk anonymous-to-login first.
- [ ] Rule. Head anonymous-to-login may not exceed trunk by more than 400 ms. Head Browse may not exceed the parent stack head by more than 400 ms.

**Review gate.** None. PR-04 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The root appends PR-04 as the stack tip. The operator lands it last.

## Close the program

- [ ] Every box above is checked with its evidence.
- [ ] Reply to the operator with the report the execution playbook names.

## Appendix A. Prototype evidence

No prototype branch was cut. The investigation read current `master` at `09b961da` plus four interrogate reviews.

Locked by code, not by a prototype.

- Browse is already tenant-scoped in `packages/core/src/queries/courses.ts`. `getPublishedCourses` filters `tenant_id`. There is no bookmark table. "Courses this school saves or creates" maps to `courses.tenant_id` and `author_id`.
- `self_enroll_subscription_course` still requires a covering subscription. `grant_free_entitlement` still refuses paid products and lives behind retired public checkout.
- Community writes in `app/actions/community.ts` never call `requirePlanFeature`. The contract test allowlist is false.
- `create_school()` never sets `tenants.plan`, so new deploys stay `free` until PR-01 drops the triggers.
- PR-01 commerce UI kill already shadows billing pages. This program does not redo that kill. It removes the engine those pages used to drive.

Unproven until the operator says otherwise.

- If Browse should list only enrolled courses, that would make Browse equal My Courses. This plan keeps the published tenant catalog.
- If community rows must be retained, drop the PR-03 table migration and keep the tables unused. The pages still go.
- If a self-hosted cap is still wanted, do not reintroduce LM001. Put a documented SQL note in the operator runbook instead of a UI upgrade loop.

## Appendix B. Alternatives rejected

Delete entitlements with the paywall. Rejected because `has_course_access` and progress still use those rows.

Hide Community in the sidebar only. Rejected because `createPost` stays a public server action and `loadMorePosts` trusts client `tenantId` with the admin client.

Remove the course-form cap UI before dropping triggers. Rejected because the teacher then hits SQLSTATE LM001 with no recovery.

Set `platform_plans.limits` to `-1` and keep the trigger functions. Weighed as a reversible first step. Rejected for the final PR-01 shape because the product has no upgrade path. A later operator would still have an enforcement engine to misunderstand. PR-01 drops the triggers instead of leaving a dormant gate.

Invent a save or bookmark table for Browse. Rejected. No such table exists. The user request is satisfied by tenant-owned published courses.

Delete `plans` and `subscriptions` in this program. Rejected. They are school-sold access records. Only the storefront and the Browse overlay go.

## Appendix C. Risks

PR-01. Seed data and Playwright helpers still assume Default School is Free. Missing a spec rewrite will fail CI or recreate the cap. Owner watches `tests/playwright` and `supabase/seed.sql`.

PR-01. `has_course_access` still reads `access_cutoff_at`. If the cron is deleted but old cutoff timestamps remain, students stay locked. The migration must clear those timestamps.

PR-02. Empty `plan_courses` today means "covers all" in UI and "covers none" in the RPC join. Membership enroll must not copy that split.

PR-02. Admin enrollments page is read-only. If the new RPC is wrong, no dashboard grant backup exists. Owner ships the RPC and the Browse button in the same PR.

PR-03. Course delete currently `ON DELETE SET NULL` on community posts. After the drop, confirm course delete still passes FK checks.

PR-03. Lesson comments are a different subsystem. A greedy grep could delete them. Live lane 5 is the guard.

PR-04. Naive delete of `(public)/checkout` breaks any remaining `changePlan` import. PR-02 must move or delete those importers first.

Control skill. `cursor-team-kit` `control-ui` is not in this workspace. Lanes drive `http://lvh.me:3000` with `agent-browser` and `computerUse`. Appendix D lists both.

pstack playbooks. This repo may not contain `pstack/skills`. Owners follow this plan file when `git show origin/main:pstack/...` fails. Trunk remains `origin/master`.

## Appendix D. Links and reading list

Read before PR-01. `supabase/migrations/20260901120000_plan_limit_db_triggers.sql`, `lib/plans/server.ts`, `lib/billing/access-cutoff.ts`, `app/[locale]/layout.tsx`, `components/teacher/course-form.tsx`.

Read before PR-02. `packages/core/src/queries/courses.ts`, `lib/hooks/use-enrollment.ts`, `supabase/migrations/20260516130000_phase2_self_enroll_rpc.sql`, `app/[locale]/dashboard/student/browse/page.tsx`, `lib/auth/retired-marketing-path.ts`.

Read before PR-03. `app/actions/community.ts`, `docs/COMMUNITY_SPACES.md`, `tests/unit/plan-feature-gate-contract.test.ts`.

Read before PR-04. `next.config.ts` `COMMERCE_GONE_PATHS`, `components/commerce-gone-page.tsx`, `PRODUCT.md`.

How and interrogate already ran for this investigation. Re-run `pstack/skills/how/SKILL.md` only if an owner finds a new enroll RPC shape that this appendix does not cover. Re-run interrogate on PR-02 if membership enroll writes a new SECURITY DEFINER function.

Trail. Owners start `decisions.tsv` within 15 minutes of spawn, uncommitted, per `pstack/skills/show-me-your-work/SKILL.md`.
