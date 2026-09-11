# BotEducation

Free, open-source, self-hosted LMS. Clone this repo, run Next.js on your own Supabase, and connect Grok bots as professors through MCP. One school per deploy. This is not a hosted SaaS, marketplace, or billing platform.

BotEducation is a fork of [lms-front](https://github.com/guillermoscript/lms-front) by Guillermo Marin. The git history, MIT license, and original copyright notice are unchanged.

[![CI](https://github.com/MrF1ow/boteducation/actions/workflows/ci.yml/badge.svg)](https://github.com/MrF1ow/boteducation/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Setup:** [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) · **Contribute:** [`CONTRIBUTING.md`](CONTRIBUTING.md) · **Professor MCP tools:** [`docs/MCP_SETUP.md`](docs/MCP_SETUP.md)

**Stack:** Next.js 16 App Router · TypeScript · Supabase (Postgres + Auth + RLS) · MCP at `/api/mcp`

## What's in it

| | |
|--|--|
| **One school** | One deploy is one school. Local login still uses `lvh.me` so the host can carry a tenant slug. Isolation is Row Level Security in Postgres. |
| **Courses** | Lessons, exercises, exams, homework assignments, progress. |
| **Grok professors** | Bots call MCP tools at `https://<your-domain>/api/mcp`. Humans bind a bot and paste a bearer token. There is no Grok chat UI in this app. |
| **Students** | Course home, assignments, grades, calendar. |
| **i18n** | English and Spanish. Do not delete it. |

Self-host one school on your own machines. The MIT license covers that use. Commerce routes in this fork redirect to `/dashboard`; payment modules may still sit in the tree until a later delete.

## Prerequisites

- Node.js 20+
- Docker (required for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Grok / xAI bot. Put `XAI_API_KEY` on the Grok side, not in this app.

## Quick Start

1. **Clone and install**
   ```bash
   git clone https://github.com/MrF1ow/boteducation.git
   cd boteducation
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   For local Supabase, set these four. Run `supabase status` (after step 3) and copy its **Publishable** and **Secret** keys — they are local-only dev keys, the same on every machine:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=<Publishable key from `supabase status`>
   SUPABASE_SERVICE_ROLE_KEY=<Secret key from `supabase status`>
   NEXT_PUBLIC_PLATFORM_DOMAIN=lvh.me:3000
   ```

3. **Start local Supabase** _(requires Docker)_
   ```bash
   supabase start
   npm run db:reset   # applies all migrations + seeds tenants, users, courses, products
   ```

4. **Run the dev server**
   ```bash
   npm run dev
   ```

5. **Open the app at `http://lvh.me:3000` — not `localhost`**

   Tenant resolution reads the subdomain; `lvh.me` resolves `*.lvh.me` to `127.0.0.1`. On `localhost` no tenant resolves and authenticated pages bounce to `/join-school`.

   - `http://lvh.me:3000` — Default School (free plan)
   - `http://code-academy.lvh.me:3000` — Code Academy Pro (enterprise plan)

6. **Log in** with a seeded account (all passwords `password123`), on the subdomain matching its tenant:

   | Email | Tenant | Role |
   |--|--|--|
   | `student@e2etest.com` | Default School (`lvh.me:3000`) | student |
   | `owner@e2etest.com` | Default School (`lvh.me:3000`) | admin + super admin |
   | `creator@codeacademy.com` | Code Academy (`code-academy.lvh.me:3000`) | admin |
   | `alice@student.com` | Code Academy (`code-academy.lvh.me:3000`) | student |

   Local-dev credentials only — seeded by `npm run db:reset`.

7. **Connect a Grok professor**

   Log in as `owner@e2etest.com`. Open **API Tokens**. Create a professor token scoped to a course. Copy the paste block:

   ```
   MCP URL
   https://<your-domain>/api/mcp
   Authorization
   Bearer <token>
   ```

   In the Grok / xAI bot config, add a remote MCP server with that URL and bearer token. On the course settings page, save a professor bot (system prompt, rubric, optional linked token). Tool names live in [`docs/MCP_SETUP.md`](docs/MCP_SETUP.md).

**Full walkthrough — seed contents, migrations, tests, optional services, troubleshooting: [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md).**

## npm Scripts

| Script | Command |
|--------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (TypeScript + lint) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:unit` | Vitest unit tests |
| `npm test` | Playwright E2E tests (dev server must already be running) |
| `npm run db:reset` | Reset local DB (migrations + seed) |
| `npm run db:push` | Push migrations to cloud Supabase |
| `npm run db:types` | Regenerate `lib/database.types.ts` |
| `npm run mcp:build` | Build the MCP server sub-project |

## Documentation

- [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) — **full local setup guide: env, seed data, migrations, tests, troubleshooting**
- [`docs/MCP_SETUP.md`](docs/MCP_SETUP.md) — connect a Grok professor (PAT at `/api/mcp`) and professor tool names
- [`CLAUDE.md`](CLAUDE.md) — architecture reference for AI agents and developers
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — complete DB schema
- [`docs/AUTH.md`](docs/AUTH.md) — authentication flows

More in [`docs/`](docs/).

## Contributing

Contributions are welcome — bug reports, translations, docs fixes, features.

- Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow and what reviewers look for
- Browse [`good first issue`](https://github.com/MrF1ow/boteducation/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) and [`help wanted`](https://github.com/MrF1ow/boteducation/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
- Questions and ideas: [Discussions](https://github.com/MrF1ow/boteducation/discussions)
- Found a vulnerability? [`SECURITY.md`](SECURITY.md) — please report it privately
- By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE). Copyright (c) 2026 Guillermo Marin. Forked from [lms-front](https://github.com/guillermoscript/lms-front).
