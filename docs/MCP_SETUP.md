# Connect a Grok professor

How to paste a BotEducation MCP endpoint into a Grok / xAI remote MCP config so a bot can run a course.

## What you get

Paste `https://<your-domain>/api/mcp` plus a bearer PAT into a Grok / xAI remote MCP config.

There is no Grok chat UI in this app. Humans mint a token and bind a bot. The bot calls tools.

```
MCP URL
https://<your-domain>/api/mcp
Authorization
Bearer <token>
```

## Prerequisites

You need a running LMS, a reachable Supabase, and a staff login.

1. Start the app with `npm run dev` and open `http://lvh.me:3000` (not `localhost`).
2. Use local Supabase (`supabase start` then `npm run db:reset`) or a hosted project with the same migrations applied.
3. Log in as a tenant `admin` or `teacher`. Seeded local admin is `owner@e2etest.com` / `password123`.

The Next.js app proxies MCP at `/api/mcp`. Locally the sidecar in `mcp-server/` must still listen on port 3001. Set `MCP_SERVER_URL=http://127.0.0.1:3001` in `.env.local`.

```bash
cd mcp-server
cp .env.example .env
npm install
PORT=3001 npm run dev
```

The sidecar defaults to port 3000 and will fight Next. Keep it on 3001. `MCP_PROXY_SECRET` must match in the root `.env.local` and `mcp-server/.env` when that env var is set.

## Create a professor token

1. Log in locally as `owner@e2etest.com`.
2. Open **API Tokens** (`/dashboard/admin/api-tokens`).
3. Create a professor token scoped to a course.
4. Copy the paste block once. The raw token is shown only at create time.

The block is built by `professorPasteBlock()` in `lib/mcp/token-create.ts`.

```
MCP URL
https://<your-domain>/api/mcp
Authorization
Bearer <token>
```

In the Grok / xAI bot config, add a remote MCP server with that URL and bearer token. On the course settings page, save a professor bot (system prompt, rubric, optional linked token).

## Auth that actually ships

Bearer PAT on `POST /api/mcp` and `POST /api/mcp/cli` (alias). Both hit `app/api/mcp/[[...path]]/route.ts`. `/cli` is rewritten to `/mcp`.

`resolvePatProxyHeaders` in `lib/mcp/pat-proxy.ts` does the work.

1. Call `validate_mcp_api_token` with the raw PAT.
2. Mint a user JWT via `mintUserAccessToken`.
3. Forward `Authorization: Bearer <jwt>` and `X-Mcp-Course-Ids` to the sidecar.

`X-User-*` headers are not auth. The proxy deletes a client-supplied `X-Mcp-Course-Ids` and sets it only from a validated PAT.

Session cookies and OAuth connectors are a second path. They are not the Grok path.

## Course scope

Scope lives on `mcp_api_tokens.course_ids`.

Empty or null means every course the user staffs. A non-empty array locks the token to those course ids.

`LmsSession.assertCourseInScope` in `mcp-server/src/session.ts` denies other courses. A scoped token that calls a tool on course 1002 while allowed only `[1001]` gets `Access denied`.

## Grades

`lms_grade_assignment_submission` writes `grades.published=false` unless tenant setting `auto_publish_grades` is on (`tenant_settings.setting_key`, JSON `{ "enabled": true }`). Then call `lms_publish_grade` so the student can read the score.

Students only `SELECT` published grades. RLS on `grades` requires `published = true` for the student row.

`assignments.published` is a different flag. It controls whether students can see the assignment, not whether a grade is visible.

## Professor tools

Names come from `PROFESSOR_TOOL_OPTIONS` in `lib/mcp/professor-tools.ts`. Descriptions come from `mcp-server/src/tools/assignments.ts` and the course, lesson, and exam tools for the first six names. The canonical gradebook tool is `lms_get_gradebook`.

| Tool | Description |
|--|--|
| `lms_get_course` | Get detailed information about a course including its lessons, exams, and enrollment count. |
| `lms_create_lesson` | Create a new lesson in a course in draft status. Optionally schedule auto-publish with publish_at. |
| `lms_update_lesson` | Update lesson fields like title, content, description, status, or publish_at schedule. |
| `lms_publish_lesson` | Publish a lesson by setting its status to `published`. |
| `lms_create_exam` | Create a new exam with optional questions and options in a single call. Recommended for bulk creation. |
| `lms_update_exam` | Update exam metadata like title, description, duration, or status. |
| `lms_create_assignment` | Create a homework assignment on a course. `due_at` is ISO-8601. `late_policy` kinds are `reject`, `accept`, `accept_until`, `penalize`. |
| `lms_update_assignment` | Update a homework assignment's title, body, due date, late policy, or rubric. |
| `lms_set_deadline` | Set or clear an assignment `due_at` timestamp. |
| `lms_list_submissions` | List homework submissions for an assignment. |
| `lms_get_submission` | Get one homework submission by `submission_id`. |
| `lms_grade_assignment_submission` | Grade a homework submission. Leaves `published=false` unless tenant `auto_publish_grades` is on. Call `lms_publish_grade` to release a draft. |
| `lms_publish_grade` | Publish a draft homework grade so the student can read the score. |
| `lms_post_announcement` | Post an in-app course announcement. Does not send email. |
| `lms_get_gradebook` | List homework grades and exam scores for a course. |
| `lms_list_roster` | List students enrolled in a course. Alias of the enrollment roster. |

The sidecar registers more tools under `mcp-server/src/tools/`. A professor PAT is still bound by course scope and staff RLS.

## Gotchas

- Bot `tool_allowlist` on `course_professor_bots` is stored in the UI. `mcp-server/` does not enforce it.
- Live e2e `tests/playwright/homework-happy-path.spec.ts` skips without `PROFESSOR_PAT` or `/tmp/professor-pat.txt`.
- Student submit is text only. File uploads are stored as `files: []`.

## Optional Claude OAuth

Claude custom connectors can still use session cookies or Supabase OAuth against `/api/mcp`. Dashboard → API Tokens still shows a Claude connector card.

That path is not how you connect a Grok professor. Use the bearer PAT on `POST /api/mcp`.
