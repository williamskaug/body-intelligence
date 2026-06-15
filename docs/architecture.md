# Architecture

This document captures the *why* behind the locked architectural decisions. `CLAUDE.md` describes the *what*; this is the rationale you'll want when a decision needs revisiting.

## Vision

Body Intelligence is a passive memory layer for an athlete's body and training. It mirrors Project Intelligence in shape: structured rows for the things that have schemas (workouts, daily entries, health events) plus a small library of markdown memory files for the qualitative context (training principles, goals, injury history). It exposes an MCP surface so any Claude instance can read and write the data through natural conversation.

The product target is "you can hand a Claude conversation everything it needs to reason like a thoughtful coach who knows your body, without copy-pasting context every time."

## The passive-app principle

The most important architectural decision is what BI deliberately does not do.

**No internal LLM calls.** No "score my readiness" endpoint. No "should I train today" tool. No server-side reasoning of any kind. The data model and memory files are the entire app surface.

**Why:** the moment the app starts having opinions, three things break. (1) The opinions go stale faster than you can update them — coaching wisdom evolves, but deployed scoring algorithms don't. (2) You stop being able to swap in better reasoning by opening a fresh Claude conversation. (3) The product becomes a bundle of judgments that need to be evaluated for safety, accuracy, and bias — instead of a memory layer that's clearly a tool, not a coach.

By keeping BI passive, every new training principle the user discovers, every new piece of research, every conversation with a real coach becomes immediately usable — they update `PRINCIPLES.md` and the next Claude conversation reads it.

**The compute-vs-author line.** The app *may* compute statistics (means, standard deviations, z-scores, date arithmetic, threshold comparisons against constants declared in code) and *may* display judgments authored by Claude (the readiness gate, gate reason, and briefing prose that the user's scheduled agent writes into `derived_daily` and `briefings/`). It may *never author* a judgment — no composite that weights multiple signals into a verdict, no "should you rest" semantics, no principle selection. So: `lib/data-display/anomalies.ts` computing "RHR 70 vs baseline 57±4" is allowed (descriptive statistic); a server function that picks which of the user's principles applies today and renders a confident conclusion is not — that is the app pretending to reason, and it was removed. The dashboard's `TodayHero` renders the agent's gate verbatim when a fresh `derived_daily` row exists and shows *signals only* (never a fabricated verdict) when it doesn't.

## Integrations are not BI's problem

A second principle, downstream of the first: **BI does not ingest data from external services.** Garmin, Strava, Apple Health, Whoop, Oura — none of them are BI's responsibility to integrate with. Each is a separate Claude connector (its own MCP), and Claude composes them with BI at conversation time.

A "Garmin sync" is not a service BI runs. It's a Cowork scheduled-agent recipe whose prompt instructs Claude to: (1) call the Garmin connector MCP for yesterday's data, (2) call BI's `log_workout` and `log_daily` tools to persist it. BI never sees Garmin credentials, never pings garmin.com, never imports a scraping library.

**Why:** every connector you build into the app is a maintenance burden, a credential-storage liability, and a coupling between products that should evolve independently. By keeping ingestion in user-controlled connectors and orchestration in user-controlled recipes, BI stays small, the connector ecosystem benefits any other Claude-based tool the user has, and credentials live in exactly one place per service.

**Implication for the schema:** `workouts` carries a `source_id` column so connector-driven writes are idempotent across recipe re-runs. `(user_id, source, source_id)` is unique where `source_id is not null`; manual entries (no source_id) can be duplicated freely. `daily_entries` is already idempotent via `(user_id, date)` unique, so it doesn't need the column.

**Implication for recipes:** the Recipe type carries a `required_connectors` field so the `/agents` UI can show users which external MCPs each recipe expects. Recipes that need only BI (morning check-in, weekly review) leave it empty. Recipes that need Garmin or Strava list them explicitly.

## Why Postgres (not markdown files)

We seriously considered a markdown-only design (folder of files synced via iCloud). It's simpler. We chose Postgres anyway.

**For:**
- Phone capture works trivially over a remote MCP. Markdown-on-disk requires either iCloud sync + a local MCP (desktop-only) or a custom file-sync layer.
- Time-series queries (HRV trend the week before getting sick) become SQL instead of parsing 14 daily files.
- Multi-user is one decision away. RLS makes it cheap to add later. Markdown-only would require a rewrite.
- Connector recipes can run from any Claude session, anywhere; they don't need a synced filesystem.

**Against (cost we accepted):**
- More infra: Supabase + Vercel + auth + RLS instead of zero-infra.
- Lose markdown's "edit in any text editor" property — though for the *memory file layer specifically* we get most of it back via the virtual filesystem (`fs_read`/`fs_write`).
- Schema migrations to manage.

The memory-file layer is the bridge between the two designs: it's stored in Postgres rows but Claude treats it like a filesystem. Best of both.

## Why Next.js (not a Python MCP server)

The original sketch was a FastMCP Python server. We pivoted to Next.js + Vercel for one reason: this might become a product, and the productization path through Next.js + Supabase is paved. A Python MCP can't carry a UI; a Next.js app can.

The original cost we worried about — that Garmin and Strava libraries are Python-native — disappeared once integrations became external connectors. BI never touches those APIs, so it doesn't matter what language they're written in.

## Why OAuth (not API keys)

API keys leak. They get committed to git, pasted into Slack, left in `.env.local` files that get backed up to clouds. They have no central revocation story. They don't expire.

OAuth 2.1 with Dynamic Client Registration solves all of this:
- Tokens are tied to a user session. Revoke the user's auth, all their tokens die.
- Tokens expire (1h access, 30d refresh) and refresh silently.
- DCR means each Cowork install gets its own client ID — granular revocation per install.
- The user never sees a token. There's no copy-paste step. Connection happens through a browser flow.

**Cost:** ~300 LOC of route handlers vs. ~20 LOC for an API key check. Worth it.

**Risk:** Cowork's MCP client must support OAuth 2.1 + DCR. The MCP spec mandates it for protected servers, and major clients have been rolling support out. We treat this as the highest-risk step in the architecture and validate it via `/spike-oauth` before building further. If it fails, fallback options exist (manual client pre-registration), but we'd want to know early.

## Why Drizzle (not raw supabase-js, not Prisma)

Raw `supabase-js` queries are stringly-typed and lose all the schema information at the call site. Prisma is heavyweight and its type generation is slow enough to be annoying in dev. Drizzle hits the sweet spot: SQL-shaped, fully type-safe, fast migrations.

**Convention:** all DB access goes through Drizzle. The only exception is the Supabase auth callback, which uses `@supabase/ssr` because that's what the auth flow expects. RLS policies are written as SQL inside Drizzle migrations.

## Why Zod at the boundary

Drizzle gives us types at compile time. Zod gives us types at runtime. The MCP boundary is where untrusted input enters the system — every tool must Zod-parse its input before touching the DB. This catches not just typos but also schema drift between client and server.

**Convention:** Zod schemas live in `lib/schemas/` and are derived from Drizzle types where possible (`createInsertSchema` from `drizzle-zod`). One schema per tool input. Output types come from Drizzle's inferred types directly — no Zod needed on the way out.

## Data model rationale

Six tables. Each one earns its place:

- **`workouts`** — workouts have richer qualitative content than other entities ("knee twinge mile 4 settled by mile 6"), and there can be multiple per day (brick = ride + run). Free-form `type` field instead of an enum because real training defies clean taxonomies.

- **`daily_entries`** — one row per (user, date). Combines sleep, wellness scales, body metrics (weight/HRV/RHR), and meal notes. We considered separate tables; one wide table won because (a) you log them all at once in the morning, (b) querying "what did my body look like on date X" is a single SELECT, (c) the column count is bounded.

- **`health_events`** — append-only log keeps the model simple. Active issues are rows with `resolved_date IS NULL`. No state machine, no transitions table.

- **`documents`** — the virtual filesystem. Eight standard paths per user (PROFILE, PRINCIPLES, GOALS, etc.) seeded on signup. Users can create additional paths if they want to extend.

- **`oauth_clients`** + **`oauth_tokens`** — minimum viable OAuth state. DCR creates client rows; the auth flow creates token rows.

The wellness scales convention (**all 1–5, 5 = best**) is critical and worth preserving even when it feels mildly unintuitive at the capture site. It means Claude can sum or average the scales without sign-flipping logic, which keeps recipe prompts simpler.

## MCP surface rationale

Seven tools, organized by capture vs. read. The principle: each tool does one well-named thing, and there's no "do something smart" tool that would smuggle synthesis into the app layer.

`log_daily` accepts partial fields — you might log sleep at 7am and meals at 9pm. Upsert by `(user_id, date)`.

`get_recent` is the one "convenience" tool — it returns a typed bundle across multiple entity types. Rationale: nearly every reasoning task starts with "what's been going on lately," and it's wasteful to make Claude run three separate queries to get there.

`search_everything` is a text search across all entity tables and documents. Postgres FTS suffices; no separate search index in v1.

## Trade-offs we accepted

- **Vercel cold starts.** Remote MCPs on serverless will have ~200–500ms cold-start latency for the first call after idle. Acceptable for a personal tool. If it becomes a product issue, we move to Vercel Edge or a long-running container.

- **No offline capture.** Phone without signal can't log. Acceptable trade for the multi-device benefits. A future PWA shell could buffer locally and flush on reconnect.

- **Connector availability is the user's problem.** If a user installs the Garmin sync recipe but doesn't have a Garmin MCP connected to Cowork, the recipe will fail at runtime. The `/agents` page surfaces `required_connectors` to make this discoverable, but we don't gate installation. Users can install BI, then later connect Garmin, then re-run the recipe. Worse UX than auto-installing connectors, but vastly simpler app and no coupling we'd come to regret.

- **Auth flow complexity.** Custom OAuth AS is more code than a token check. We took the cost for the long-term wins (revocation, expiry, multi-install).
