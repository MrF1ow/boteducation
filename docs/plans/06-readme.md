# How to self-host BotEducation and connect a Grok bot

This is PR-06 in `docs/plans/boteducation-program.md`. Update `README.md` after PR-00. Keep it short. A separate docs site is out of this repo.

## Goal

An operator who cloned `boteducation` can run Next.js against their own Supabase, create an admin user, mint a professor MCP token, and paste the URL into a Grok bot. Credit lms-front. Keep MIT.

## Files to touch

- `README.md` (replace the SaaS pitch, keep setup commands that still work)
- `.env.example` comments only. No secrets.
- `CONTRIBUTING.md` only if it still says "sell courses" as the product. One paragraph.

Do not add a marketing site, Docusaurus, or `docs.boteducation.*`.

## README outline

1. What it is. One school. Self-hosted LMS. Professors are Grok bots that call MCP tools. Not a SaaS.
2. Credit. Forked from [guillermoscript/lms-front](https://github.com/guillermoscript/lms-front). MIT.
3. Stack. Next.js App Router, TypeScript, Supabase with RLS, MCP at `/api/mcp`.
4. Prerequisites. Node 20+, Docker, Supabase CLI, an xAI / Grok bot and `XAI_API_KEY` on the bot side (not in this app).
5. Install.

```bash
git clone https://github.com/<account>/boteducation.git
cd boteducation
npm install
cp .env.example .env.local
```

6. Fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_PLATFORM_DOMAIN`. For local Docker those four come from `supabase status`.
7. `supabase start` then `npm run db:reset` then `npm run dev`. Open `http://lvh.me:3000`.
8. Log in as the seeded admin. Open the MCP token page. Create a professor token. Copy the URL `https://<domain>/api/mcp` and the bearer token.
9. In the Grok / xAI bot config, add a remote MCP server with that URL and token. Assign the bot to a course in admin settings. Set the system prompt there.
10. What bots can do. Point at `docs/plans/03-mcp-professor.md` for the tool list. Do not duplicate the full schema in the README.

Commerce env vars may still appear in `.env.example` until PR-01. Say they are unused.

## Schema changes

None.

## Acceptance checks

- A person who has never seen lms-front can follow the README to a login screen when Docker is available.
- README names lms-front and MIT.
- README does not describe Stripe, coin stores, or subdomains as the product. It may mention `lvh.me` as the local host trick.
- No `XAI_API_KEY` in `.env.example` unless it is a commented optional that this app never reads. Prefer omitting it.

## Risks

- README drift against `/api/mcp/cli`. Write the URL PR-03 actually ships.
- Seeded passwords in the README are local-dev only. Keep that sentence.
- Upstream README badges point at `guillermoscript/lms-front` CI. Point them at this repo or drop them until CI exists here.
