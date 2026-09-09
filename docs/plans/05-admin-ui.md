# How to bind a Grok professor and hand the operator an MCP token

This is PR-05 in `docs/plans/boteducation-program.md`. Depends on PR-02 and PR-03. This is the only admin UI required for BotEducation's first loop.

## Goal

An admin (human) can bind one or more Grok professor configs to a course, create a professor MCP token, copy the MCP URL and token once, and toggle auto-publish of AI grades. Professors do not use this UI. They use the token from Grok.

## Files to touch

- `app/[locale]/dashboard/teacher/api-tokens/page.tsx` and `app/[locale]/dashboard/admin/api-tokens/page.tsx`. Today they print `https://<slug>.<domain>/api/mcp/cli`. Change the copied URL to `https://<domain>/api/mcp` for a single-school deploy. Keep slug URLs working until PR-01 removes extra tenants.
- `components/dashboard/api-tokens-page`. Show course scope checkboxes, role professor, and the paste block for xAI remote MCP (URL plus bearer token).
- `app/actions/mcp-tokens.ts`. Persist `course_ids` and `token_role`. Return the raw token only on create.
- New course settings section on `app/[locale]/dashboard/teacher/courses/[courseId]/settings/page.tsx` for `course_professor_bots` (system prompt, rubric rules, late policy default, model, tool allowlist, linked token).
- Admin school settings (`app/[locale]/dashboard/admin/settings/page.tsx` or a small new card) for `auto_publish_grades` via `tenant_settings`.
- No Grok chat widget.

## Schema changes

None beyond PR-02. If settings UI needs a default row for `auto_publish_grades`, upsert `{ "enabled": false }` on first load.

## Operator paste block

Show these strings, nothing else.

- MCP URL `https://<their-domain>/api/mcp`
- Authorization `Bearer <token>`
- Hint that docs (later, outside this repo) cover creating the Grok bot and assigning it to a course.

Do not put `XAI_API_KEY` in this app. The operator puts that key on the Grok / xAI side.

## Acceptance checks

- Admin creates a token scoped to one course. The create response shows the URL and the raw token once. Reload hides the raw token.
- That token can call `lms_get_course` for the scoped course and is denied on another course (proven in PR-03 tests, rechecked here with the token from the UI).
- Admin saves a professor bot with a system prompt and a tool allowlist. Row appears in `course_professor_bots`.
- Toggle auto-publish on. A subsequent MCP draft grade from tests publishes. Toggle off. The next grade stays draft.
- Student UI is unchanged except published grades appearing when the gate allows it.
- `npm run typecheck` exits 0.

## Risks

- Copying `https://slug.domain/api/mcp/cli` into Grok will fail if PR-03 only fixed the unsuffixed path. Support both or redirect `/cli` to the same handler.
- Showing the token twice in logs or analytics (`track` in `app/actions/mcp-tokens.ts`) would leak a secret. Confirm `safeAnalytics` never records the raw token.
- Linking a bot to a token that the admin does not own. Restrict `mcp_token_id` to tokens where `user_id = auth.uid()`.
