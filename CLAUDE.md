# Body Intelligence (BI)

Personal health intelligence — the same shape as Project Intelligence, but for the athlete-self instead of the work-self. Tracks workouts, sleep, nutrition, wellness check-ins, and health events. Stores everything as structured rows plus a markdown-style memory layer. **The app has no internal AI** — Claude does all reasoning over the data via the MCP surface this app exposes.

## Status

Greenfield. Architecture and schema locked, ready to scaffold. No application code written yet — only design docs in `docs/`.

## The load-bearing constraint

The app is **passive**. It stores data, returns data, and exposes a virtual filesystem of memory files. It never decides whether you should train tomorrow, when to take a recovery week, or whether you're overreaching. Those judgments live in Claude conversations, made by reasoning over the data plus the user's `PRINCIPLES.md`.

This is the same architectural choice PI makes: keep the system passive so the reasoning stays portable across sessions and improves as Claude does, without app updates. **Do not introduce server-side LLM calls or scoring algorithms.** If a feature requires synthesis, it belongs in a Cowork scheduled-agent recipe (just a prompt template), not in the app.

## Integration model

BI does not ingest data from external services. **Integrations are separate Claude connectors (Garmin, Strava, Apple Health, Whoop, etc.) and Claude composes them with BI at conversation time.** A "Garmin sync" recipe is a prompt that runs in Cowork and instructs Claude to read from the Garmin connector MCP and write to the BI MCP. BI never holds Garmin credentials, never runs cron jobs against external APIs, never imports `garmin-connect` or `stravalib`.

This means:
- BI ships with no connector code. Phase 2 is not "build connectors" but "ship recipes that compose connectors with BI."
- Credentials for external services live in those connectors, not in BI.
- The MCP `log_workout` tool accepts `source` and `source_id` arguments so connector-driven writes are idempotent across recipe re-runs.
- The `/agents` page surfaces each recipe's `required_connectors` so users know which MCPs need to be connected for it to work.

## Tech stack

- Next.js 15 (App Router) + TypeScript strict
- Supabase: Postgres + Auth + Storage
- Drizzle ORM (no raw `supabase-js` queries except in the auth callback; migrations via Drizzle Kit)
- Zod at the MCP boundary for runtime validation
- `@modelcontextprotocol/sdk` for the MCP server, mounted at `/api/mcp` with HTTP+SSE transport
- Custom OAuth 2.1 + Dynamic Client Registration authorization server (~300 LOC of route handlers)
- shadcn/ui + Tailwind for the small UI
- Vercel for hosting (no cron — see *Integration model*)
- `pnpm` for package management

## Repo layout (target — most of this is created during scaffold)

```
body-intelligence/
├── app/
│   ├── (marketing)/page.tsx           landing, sign-in CTA
│   ├── login/page.tsx                 magic-link form
│   ├── auth/callback/route.ts         Supabase auth callback
│   ├── (app)/
│   │   ├── layout.tsx                 authed shell
│   │   ├── page.tsx                   dashboard (Phase 3)
│   │   ├── agents/page.tsx            recipe library + install modal
│   │   └── settings/page.tsx          connected applications, profile
│   └── api/
│       ├── mcp/route.ts               remote MCP endpoint
│       └── oauth/
│           ├── authorize/route.ts
│           ├── token/route.ts
│           ├── register/route.ts
│           └── .well-known/oauth-authorization-server/route.ts
├── lib/
│   ├── db/
│   │   ├── schema.ts                  Drizzle table definitions
│   │   ├── client.ts                  Drizzle + postgres client
│   │   └── migrations/
│   ├── mcp/
│   │   ├── server.ts                  MCP server bootstrap + tool registry
│   │   └── tools/                     one file per tool
│   ├── oauth/                         AS implementation
│   ├── memory/
│   │   └── templates/                 seed content for the 8 standard memory files
│   ├── agents/
│   │   └── recipe-data.ts             scheduled-agent recipes
│   └── schemas/                       Zod schemas mirroring Drizzle types
├── docs/
│   ├── architecture.md
│   ├── schema.md
│   ├── mcp-tools.md
│   └── recipes.md
├── .claude/
│   ├── settings.json
│   └── commands/
└── (config: .env.example, .gitignore, README.md, package.json, tsconfig.json,
   next.config.ts, drizzle.config.ts, tailwind.config.ts)
```

## Data model

Seven Postgres tables. RLS on every user-scoped one, scoped to `auth.uid()`.

- `user_profiles` — one row per user, seeded on signup. `display_name`, `timezone` (IANA), `units_system` (`metric`/`imperial`), `locale`, `preferences` (jsonb forward-compat blob).
- `workouts` — one row per workout. `date`, free-form `type`, `duration_min`, `distance_km`, `avg_hr`, `max_hr`, `rpe`, `shoes`, `source`, `source_id` (idempotency key for connector writes), `notes`.
- `daily_entries` — one row per (user, date), enforced by unique. Sleep, HRV, RHR, weight, six 1–5 wellness scales (**5 = best, always, even for fatigue/soreness/stress**), and three free-text notes blocks (sleep, wellness, meals).
- `health_events` — append-only log of injuries, illnesses, symptoms. `date`, `kind`, `body_part`, `severity`, `notes`, `resolved_date`.
- `documents` — virtual filesystem for memory files, keyed by `(user_id, path)`. Content is text. Standard paths: `MEMORY.md`, `PROFILE.md`, `PRINCIPLES.md`, `GOALS.md`, `CURRENT.md`, `HEALTH_LOG.md`, `NUTRITION.md`, `EQUIPMENT.md`.
- `oauth_clients` — DCR-registered MCP clients (Cowork instances). Not user-scoped.
- `oauth_tokens` — issued access + refresh tokens, hashed, with TTLs and revocation.

Full DDL and RLS policies: `docs/schema.md`.

## MCP surface (seven tools)

Capture:
- `log_workout(date, type, ...)` → upsert into `workouts`
- `log_daily(date, ...partial)` → upsert into `daily_entries`; partial fields allowed
- `log_health_event(date, kind, body_part, ...)` → insert into `health_events`
- `fs_write(path, content)` → upsert into `documents`

Read:
- `fs_read(path)` / `fs_list(prefix?)` / `fs_search(query)` — virtual filesystem over `documents`
- `get_recent(days, kinds=['workouts','daily','health_events'])` — typed bundle
- `search_everything(query)` — text search across all entity tables + documents

All tools authenticated via OAuth bearer token. RLS handles user scoping; tools never accept a `user_id` argument.

Full spec: `docs/mcp-tools.md`.

## Memory file layer

Eight standard markdown documents per user, stored as rows in `documents`. Seeded on user creation from `lib/memory/templates/`. The user (or Claude on their behalf via `fs_write`) edits these over time.

| Path | Purpose |
|------|---------|
| `MEMORY.md` | One-liner index over the other files |
| `PROFILE.md` | Anthropometrics, training history, equipment |
| `PRINCIPLES.md` | Training philosophy, the decision rules Claude reasons against |
| `GOALS.md` | A/B/C races, performance benchmarks |
| `CURRENT.md` | This week's plan, active training block, next race |
| `HEALTH_LOG.md` | Append-only history of injuries, illnesses, niggles |
| `NUTRITION.md` | What works, what wrecks you, dietary preferences |
| `EQUIPMENT.md` | Gear inventory, mileage, condition |

Each template is markdown with embedded fill-in prompts so a new user knows what belongs in each file. Templates are drafted in `lib/memory/templates/` and committed to the repo — they're the source of truth for what gets seeded.

**Format conventions enforced by templates:**
- `GOALS.md` race blocks use a fixed shape (`## Race: <name>` + `- Date: YYYY-MM-DD` + Tier/Distance/Goal/Notes). The race-countdown recipe parses these — break the convention and the recipe stops firing.
- `HEALTH_LOG.md` event blocks use a fixed shape (`## YYYY-MM-DD — <body part> — <kind>` + Mechanism/Severity/Treatment/Resolution/Lessons). The health-log audit recipe relies on this.

## Recipe library

`lib/agents/recipe-data.ts` exports a typed array of scheduled-agent recipes. Each recipe is `{ id, title, category, schedule, description, prompt, required_tools, required_connectors }`. The `/agents` page renders them as cards; users click *Install* → modal shows the full prompt + schedule with a copy button. They paste into Cowork's *New Scheduled Task* dialog.

`required_connectors` lists external Claude connectors the recipe expects to find in Cowork (e.g. `["garmin"]`, `["strava"]`). Recipes that need none — pure BI recipes — leave the array empty.

Starter set (target eight):
0. Onboarding — user-triggered once, walks first-time users through PROFILE / GOALS / PRINCIPLES (BI-only)
1. Morning check-in — daily 7am local (BI-only)
2. Evening reflection — daily 9pm local (BI-only)
3. Weekly review — Sunday 6pm local (BI-only)
4. Race countdown — daily during the 14 days before any race in `GOALS.md` (BI-only)
5. Health-log audit — biweekly (BI-only)
6. Garmin sync — Phase 2 (requires Garmin connector)
7. Strava sync — Phase 2 (requires Strava connector)

Full prompts: `docs/recipes.md`.

## Auth model

OAuth 2.1 + Dynamic Client Registration, custom AS hosted by the BI app on top of Supabase Auth. **No long-lived API keys, ever.**

- User identity layer: Supabase Auth (magic link default; Google as optional provider)
- BI as Authorization Server: `/.well-known/oauth-authorization-server`, `/api/oauth/{authorize,token,register}`
- `/api/mcp` validates `Authorization: Bearer <token>` → resolves `user_id` → all DB access then scoped by RLS
- Tokens: 1h access, 30d refresh, hashed at rest, revocable from Settings → Connected Applications

The first time a user adds the BI MCP URL to Cowork, Cowork's MCP client runs DCR, opens the BI authorize page, the user signs in via Supabase, and tokens flow back to Cowork. No copy-paste step.

## Signup model

**Open public signup from day one.** Anyone with an email can sign up via Supabase Auth magic link. Implications baked into Phase 1:

- Marketing landing page at `/` is a real surface, not a stub. Plain copy explaining what BI is, screenshot of the recipe library, sign-in CTA.
- Email deliverability matters. Configure Supabase Auth to use Resend (or similar) SMTP rather than the default Supabase sender, which has poor inbox placement.
- Basic abuse hardening on the signup path: hCaptcha or Cloudflare Turnstile in front of the magic-link request, plus Supabase's per-email rate limits.
- Stub `/legal/terms` and `/legal/privacy` pages — minimal content is fine, but they need to exist before the signup form's checkbox.
- Onboarding recipe (recipe #0) becomes load-bearing. New users see eight templated memory files until the recipe walks them through filling them in.

## Conventions

- TypeScript strict. No `any` without an inline comment justifying it.
- File naming: kebab-case for files, PascalCase for React components, camelCase for functions and variables.
- No default exports for React components or library functions — named exports only.
- Server Components by default. Client components mark `"use client"` and live in the same directory as their server parent.
- All DB access through Drizzle. Raw SQL only inside `lib/db/migrations/`.
- Zod schemas in `lib/schemas/` mirror Drizzle types — input validation at the MCP boundary; output types come from Drizzle's inferred types.
- One MCP tool per file under `lib/mcp/tools/`. Tools are pure functions: `(input, ctx) => result`. Side effects (DB writes) happen through `ctx.db`.
- Tests via `vitest`. Each tool ships with at least one happy-path test and one validation-failure test.
- Memory file templates are markdown with embedded prompts (`<!-- Fill in: ... -->`) so users immediately know what each file is for.

## Build phases

**Phase 1 — MVP (manual capture only).** Scaffolding, schema migrations, Supabase project, the seven MCP tools, OAuth AS + Supabase Auth integration, public signup with abuse hardening, four UI surfaces (marketing/login, /agents, /settings, /legal stubs), six seed recipes (onboarding + five capture/review), memory-file template seeding on user creation.

**Phase 2 — Connector recipes.** Two recipes (Garmin sync, Strava sync) that orchestrate external Claude connectors with BI's MCP. No code changes to BI itself; this is pure recipe authoring. Each recipe instructs Claude to read from a connector MCP and persist to BI via `log_workout` / `log_daily`, using `source` + `source_id` for idempotency.

**Phase 3 — Quality of life.** Dashboard page, better recipe library (categories + search), mobile-first capture polish.

## Status tracker

**Done:**
- Architecture and schema locked (seven tables including `user_profiles`)
- Design docs written (this `CLAUDE.md` plus `docs/`)
- Eight memory file templates drafted in `lib/memory/templates/`
- Onboarding recipe spec written
- `.claude/` project config seeded

**Next (Phase 1 scaffold):**
1. `pnpm create next-app body-intelligence --typescript --app --tailwind --eslint` (run inside the existing `body-intelligence/` folder; merge with what's there)
2. Install runtime deps: `drizzle-orm`, `drizzle-zod`, `postgres`, `@supabase/ssr`, `@supabase/supabase-js`, `@modelcontextprotocol/sdk`, `zod`
3. Install dev deps: `drizzle-kit`, `vitest`, `@types/node`, `@types/pg`
4. Initialize shadcn-ui
5. Create Supabase project (production + test). Configure Resend SMTP for Supabase Auth emails. Copy env vars into `.env.local`.
6. Write `lib/db/schema.ts` (seven tables) and run first Drizzle migration
7. Add RLS policies via Supabase SQL alongside the migration
8. Add the signup-trigger function that seeds `user_profiles` + the eight `documents` rows from `lib/memory/templates/`
9. Implement OAuth AS routes (`/api/oauth/*`)
10. Stub `/api/mcp/route.ts` with one tool (`fs_read`) end-to-end, validating Bearer tokens against `oauth_tokens`
11. **Spike: connect Cowork to the stub MCP and verify the OAuth + DCR handshake works.** Highest-risk step in the architecture — do it before building further. See `.claude/commands/spike-oauth.md`.
12. Implement the remaining six MCP tools
13. Write `lib/agents/recipe-data.ts` with all six Phase-1 recipes (onboarding + five capture/review)
14. Build the four UI surfaces: marketing landing + magic-link login (with Turnstile/hCaptcha), `/agents` (recipe library + install modal + `required_connectors` badges), `/settings` (Connected Applications + profile + Run-Onboarding button), and `/legal/{terms,privacy}` stubs
15. Deploy to Vercel; rerun the OAuth spike against the deployed URL; sanity-check signup → templates seeded → onboarding recipe → first daily check-in flow end-to-end

## Pointers

- Architectural rationale: `docs/architecture.md`
- Schema + RLS policies: `docs/schema.md`
- MCP tools spec: `docs/mcp-tools.md`
- Recipe spec + starter prompts: `docs/recipes.md`
- Memory file templates (created during scaffold): `lib/memory/templates/`
