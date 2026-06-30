# Body Intelligence (BI)

Personal health intelligence — the same shape as Project Intelligence, but for the athlete-self instead of the work-self. Tracks workouts, sleep, meals, wellness check-ins, and health events. Stores everything as structured rows plus a markdown-style memory layer. **The app has no internal AI** — Claude does all reasoning over the data via the MCP surface this app exposes.

## Status

Built and deployed (hosted at `bi.vardenlab.com`). Phase 1 (manual capture) and most of Phase 2/3 are live: the eight tables plus `installed_recipes`, `derived_daily`, `workout_metrics`, `health_event_updates`, `workout_zones`, and `capacity_metrics`; ~60 MCP tools (CRUD + a deterministic statistics engine); OAuth AS + Supabase Auth; public signup; the marketing/login/`/data`/`/agents`/`/settings`/`/legal` surfaces; the recipe catalog; and a per-user agent layer (the user's own dawn-agent runs daily and reports via `mark_recipe_run`). Migrations auto-apply to production via `.github/workflows/migrate.yml` on push to `main`.

## The load-bearing constraint

The app is **passive**. It stores data, returns data, exposes a virtual filesystem of memory files, and may **compute statistics** (means, standard deviations, z-scores, **correlations, regressions, distributions/percentiles, and EWMA training load — CTL/ATL/TSB**, all deterministic — date arithmetic, threshold comparisons against constants in code) and **display Claude-authored judgments** read from `derived_daily`. It never **authors a judgment** — no composite that weights signals into a verdict, no "should you rest" logic, no principle selection on the server. The line: the app computes a correlation coefficient / regression slope / load value (math); turning that into "you should rest / optimize X" is a verdict and stays with Claude. The readiness gate the dashboard shows is computed by the user's scheduled Claude agent and parked in `derived_daily`; the app only renders it.

This is the same architectural choice PI makes: keep the system passive so the reasoning stays portable across sessions and improves as Claude does, without app updates. **Do not introduce server-side LLM calls or scoring algorithms.** If a feature requires synthesis, it belongs in a Cowork scheduled-agent recipe (just a prompt template) writing to `derived_daily`, not in the app. The statistics engine is the substrate a future server-side model could read from; if one is ever added, it writes its judgment through `log_derived_daily` (`computed_by='model'`) — `derived_daily` stays the single judgment sink, and the engine itself never authors a verdict.

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
- shadcn/ui + Tailwind for the UI; **shadcn charts (Recharts v3)** power the Analyze view + per-metric drilldown (a deliberate, scoped departure from the old zero-client-JS rule — see *Working notes*). Inline micro-charts stay hand-rolled SVG.
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
│   │   └── client.ts                  Drizzle + postgres client
│   ├── mcp/
│   │   ├── server.ts                  MCP server bootstrap + tool registry
│   │   └── tools/                     one file per tool
│   ├── oauth/                         AS implementation
│   ├── memory/
│   │   └── templates/                 seed content for the 8 standard memory files
│   ├── agents/
│   │   └── recipe-data.ts             scheduled-agent recipes
│   └── data-display/                  pure stats + chart-data libs (statistics.ts, metric-series.ts, baseline.ts, …)
│                                      (Zod input schemas live inline per tool file — no lib/schemas/)
├── docs/
│   ├── architecture.md
│   ├── schema.md
│   ├── mcp-tools.md
│   └── recipes.md
├── .claude/
│   ├── settings.json
│   └── commands/
├── supabase/
│   └── migrations/                    Drizzle-generated SQL; auto-applied to prod by .github/workflows/migrate.yml on push to main
└── (config: .env.example, .gitignore, README.md, package.json, tsconfig.json,
   next.config.ts, drizzle.config.ts, tailwind.config.ts)
```

## Data model

Postgres tables, RLS on every user-scoped one, scoped to `auth.uid()`. Drizzle in `lib/db/schema.ts` is the source of truth; generated SQL lands in `supabase/migrations/`.

- `user_profiles` — one row per user, seeded on signup. `display_name`, `timezone` (IANA — drives `/data`'s day boundaries and the readiness gate; default `UTC` but should be set), `units_system` (`metric`/`imperial`), `locale`, `preferences` (jsonb forward-compat blob).
- `workouts` — one row per workout. `date`, `type` (canonical vocabulary — aliases normalized at the MCP boundary by `normalizeWorkoutType` in `lib/mcp/tools/shared.ts`), `duration_min`, `distance_km`, `avg_hr`, `max_hr`, `rpe`, `shoes`, `source`, `source_id` (idempotency key for connector writes), `notes` (qualitative only).
- `workout_metrics` — optional 1:1 side table keyed by `workout_id`. Running dynamics + effort sensor data (`cadence_spm`, `gct_ms`, `gct_balance_pct_left`, vertical oscillation/ratio, `stride_len_m`, `te_aerobic`/`te_anaerobic`, `vendor_training_load`, stamina start/end/min, `decoupling_pct`, elevation, speeds, `weather_temp_c`, `weather_humidity_pct`, `strength_volume_kg`). Written via the nested `metrics` object on the workout write tools. `date` denormalized for cheap trend queries. Lap splits + vendor labels stay in `daily/*.md`.
- `workout_zones` — optional 1:1 side table keyed by `workout_id`. Per-activity time-in-zone in seconds (`hr_z1_s…hr_z5_s`, `power_z1_s…power_z7_s`). Written via the nested `zones` object (parallel to `metrics`) on the workout write tools; full replace per workout. Kept separate so the cycling-heavy power nulls don't bloat `workout_metrics`.
- `daily_entries` — one row per (user, date), enforced by unique. Universal vitals (`sleep_h` + four sleep-stage minute buckets, `hrv_ms`, `rhr_bpm`, `spo2_avg_pct`, `respiration_avg_brpm`, `skin_temp_deviation_c`, `sleep_score`), recovery vendor *scalars* (`stress_score`, `body_battery_morning/high/low/charged/drained`, `training_readiness_score`, `training_status` — free lowercased text, no CHECK), body composition (`weight_kg`, `body_fat_pct`, `muscle_mass_kg`, `bone_mass_kg`, `body_water_pct`), optional health vitals (`bp_systolic_mmhg`, `bp_diastolic_mmhg`, `hydration_ml`), movement totals (`steps`, `active_calories`, `floors_climbed`, `intensity_min_moderate`, `intensity_min_vigorous`), six 1–5 wellness scales (**5 = best, always, even for fatigue/soreness/stress**), and three free-text notes blocks (sleep, wellness, meals). **Narrowed convention:** a vendor composite *scalar* you want to trend/correlate goes in its column; the factor *breakdown / hourly curve / vendor label* (Body Battery curve, Readiness factors) stays in `daily/YYYY-MM-DD.md`. `training_readiness_score` is a captured observation — NOT BI's gate.
- `derived_daily` — one row per (user, date), **written only by the user's scheduled agent** via `log_derived_daily` (the app never computes it). `readiness_gate` (green/amber/red) + `gate_reason`, `illness_composite` + per-signal flags, `hrv_z`/`rhr_z`/`sleep_z`, `sleep_debt_7d_min`, `sleep_need_min`, `acute_load_7d`, `chronic_load_28d`, `days_to_race`, provenance. **Full-row replace** on write (opposite of `log_daily`'s merge) so a recompute never leaves stale flags. `/data`'s TodayHero renders the gate from this table with a freshness ladder.
- `capacity_metrics` — one row per (user, date), written **only by the `capacity-sync` recipe** via `log_capacity` (partial-merge). Slow-moving fitness-capacity *estimates* the wearable provides: `vo2max_running`/`cycling`, lactate threshold (`hr_bpm`/`pace_s_per_km`/`power_w`), `cycling_ftp_w`, `endurance_score`, `hill_score`, `fitness_age_years`, `running_tolerance_km`, race predictions (`5k`/`10k`/`half`/`marathon_s`, seconds). Wide table so each metric is a column addressable by the stats engine. BI stores the estimate; it never computes capacity. Derived training zones go in `THRESHOLDS.md`, achieved PRs in `RECORDS.md`.
- `meals` — one row per meal. Supported but **optional** — only logged when the user actually tracks food; the dashboard surfaces nothing for meals. `eaten_at`, `meal_type`, required `description`, `calories` + macros required at the MCP boundary (estimate when no authoritative source), optional `fiber_g`. Day-level prose lives in `daily_entries.meal_notes`; dietary philosophy in `NUTRITION.md`.
- `health_events` — injuries, illnesses, symptoms. `date`, `kind`, `body_part`, `severity`, `notes` (the stable summary), `resolved_date`, `next_milestone` + `next_milestone_date` (the checkpoint gating progression, e.g. an MRI date).
- `health_event_updates` — dated thread updates on an event (`event_id`, `date`, `note`, `severity_at_time`). Replaces the old pattern of appending "STATUS …" blocks into `health_events.notes`.
- `documents` — virtual filesystem for memory files, keyed by `(user_id, path)`. Content is text. Standard paths: `MEMORY.md`, `PROFILE.md`, `PRINCIPLES.md`, `GOALS.md`, `CURRENT.md`, `HEALTH_LOG.md`, `NUTRITION.md`, `EQUIPMENT.md`, `THRESHOLDS.md`, `RECORDS.md`. Convention folders: `daily/`, `briefings/`, `recipes/`, `insights/` (Claude-authored interpretation, surfaced atop the Analyze view).
- `installed_recipes` — per-user recipe run tracking (`recipe_id`, `last_run_at`, `last_run_status`, `run_count`), written by `mark_recipe_run`. Catalog *and* user-authored recipe ids both land here.
- `oauth_clients`, `oauth_codes`, `oauth_tokens` — DCR clients, auth codes, and issued access/refresh tokens (hashed, with TTLs and revocation).

Full DDL and RLS policies: `docs/schema.md`.

## MCP surface

~60 tools: full CRUD over every entity, a deterministic statistics engine, computed/aggregate reads, recipe tracking, and a virtual filesystem for the memory layer. All authenticated via OAuth bearer token. RLS handles user scoping; tools never accept a `user_id` argument. One file per tool under `lib/mcp/tools/`; registered in `lib/mcp/server.ts`.

Capture (insert / upsert):
- `log_workout(date, type, ..., metrics?, zones?)` → insert/upsert `workouts`; `type` normalized to the canonical vocabulary; optional nested `metrics` object upserts `workout_metrics`, optional nested `zones` object upserts `workout_zones`
- `log_daily(date, ...partial)` → upsert `daily_entries`; partial merge (also the update path)
- `log_capacity(date, ...partial)` → upsert `capacity_metrics`; partial merge (capacity-sync recipe only)
- `log_meal(eaten_at, description, calories, macros, ...)` → insert/upsert `meals`
- `log_health_event(date, kind, body_part, ...)` → insert `health_events`
- `add_health_event_update(event_id, date, note, ...)` → append a dated thread update (replace-per-date for idempotency)
- `log_derived_daily(date, readiness_gate, ...)` → **full-row replace** upsert into `derived_daily` (agents only)
- `fs_write(path, content)` → upsert `documents`
- `bulk_log_workouts` / `bulk_log_daily` / `bulk_log_meals` / `bulk_log_capacity` → up to 500 rows for connector backfills

Update / resolve by id: `update_workout`, `update_meal`, `update_health_event` (also sets `next_milestone*`; pass `resolved_date` to resolve), `resolve_health_event(id, note?)`.

Delete: `delete_workout`, `delete_daily_entry(date)`, `delete_meal`, `delete_health_event`, `fs_delete(path)`. Filesystem: `fs_move`.

Read:
- `fs_read` / `fs_list(prefix?)` / `fs_search(query)` — virtual filesystem
- `get_recent(days, kinds=['workouts','daily','meals','health_events','derived','capacity'])` — typed bundle
- `get_workout` (joins `workout_metrics` + `workout_zones`), `get_daily`, `get_meal`, `get_health_event` (returns the thread), `get_capacity(as_of?)` (latest known value per capacity metric), `list_*` range queries
- `get_briefing(date?)` — reads `briefings/YYYY-MM-DD.md`
- `search_everything(query)` — text search across entity tables + documents

Computed (deterministic statistics — allowed by the passive constraint; never judgments):
- `get_baseline(metric, window_days)` / `get_stats(metric, from, to, agg)` — metric enums cover daily, `workout_*` (basic + sensor), `workout_*` zone, `capacity_*`, and `derived_*` columns (registry: `lib/mcp/tools/metrics.ts` `resolveMetric`)
- `get_streak(kind)`, `get_calendar(year, month)`, `compute_training_load(days)` (coarse weekly buckets)

Statistics engine (deterministic — each returns a statistic + provenance `note`, never a verdict; pure math in `lib/data-display/statistics.ts`, DB bridge in `metric-series.ts`):
- `get_correlation(a, b, window, lag_days?)` — Pearson + Spearman + OLS regression of b-on-a, with an optional day lag
- `get_correlation_matrix(metrics[≤8], window, lag?, method?)` — pairwise r matrix (heatmap)
- `get_distribution(metric, window, bins?)` — histogram + p5/p25/p50/p75/p95 + moments
- `get_trend(metric, window)` — OLS slope/R²/direction (sign only, no magnitude threshold)
- `get_load_balance(days)` — real CTL/ATL/TSB (EWMA τ=42d/7d, 42-day warm-up)
- `get_metric_series(metrics[≤8], window)` — aligned dense daily series for overlays/scatter

Recipes: `list_recipes(include_install_state?)` (returns the catalog plus the caller's `recipes/` docs as `user_recipes`), `get_recipe_status`, `mark_recipe_run`, `list_connectors` (role-aware source status). Onboarding: `get_setup_guide()`.

There is no `update_daily_entry` — `log_daily` is both create and update via the `(user, date)` upsert. Prefer `update_*` over `delete_*` when correcting data so history stays intact.

Full spec: `docs/mcp-tools.md`.

## Memory file layer

A virtual filesystem of markdown documents per user, stored as rows in `documents` keyed by `(user_id, path)`. Paths are slash-separated and end in `.md`; folders are implicit, derived from the path. Ten standard top-level files are seeded on user creation from `lib/memory/templates/`; everything else is created on demand. The user (or Claude on their behalf via `fs_write` / `fs_move` / `fs_delete`) maintains them.

Suggested folder layout for organization:
- `daily/YYYY-MM-DD.md` — per-day vendor scores (Body Battery, Readiness, etc.) and anomalies
- `weekly/YYYY-Www.md` — weekly-review outputs
- `insights/YYYY-Www.md` — the insights recipe's interpretation of the stats engine (surfaced atop the Analyze view)
- `notes/<topic>.md` — thematic notes (e.g. `notes/altitude-camp-2026.md`)
- `races/<race-slug>.md` — per-race planning + post-race debriefs

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
| `THRESHOLDS.md` | Derived training zones (LTHR, threshold pace, FTP, HR/power zones) — refreshed weekly by capacity-sync; recipes parse the block shapes |
| `RECORDS.md` | Achieved personal records (distinct from `capacity_metrics`' moving predictions) — one parseable `## PR: …` block each |

Each template is markdown with embedded fill-in prompts so a new user knows what belongs in each file. Templates are drafted in `lib/memory/templates/` and committed to the repo — they're the source of truth for what gets seeded.

**Format conventions enforced by templates:**
- `GOALS.md` race blocks use a fixed shape (`## Race: <name>` + `- Date: YYYY-MM-DD` + Tier/Distance/Goal/Notes). The race-countdown recipe parses these — break the convention and the recipe stops firing.
- `HEALTH_LOG.md` event blocks use a fixed shape (`## YYYY-MM-DD — <body part> — <kind>` + Mechanism/Severity/Treatment/Resolution/Lessons). The health-log audit recipe relies on this.

## Recipe library

`lib/agents/recipe-data.ts` exports a typed array of scheduled-agent recipes: `{ id, title, category, schedule, description, prompt, required_tools, required_connectors, covers }`. `category` is one of `autopilot | capture | review | planning | connector`. The `/agents` page renders them as cards; users *Install* → copy the prompt + cron into Cowork's *New Scheduled Task* dialog.

`/agents` has two layers. **Your agents** (top): the caller's own automation — recipe docs under `recipes/` in the virtual filesystem (parsed by `lib/agents/recipe-doc.ts`, optional YAML front-matter `title`/`schedule`/`covers`) merged with `installed_recipes` run history, plus any non-catalog recipe id tracked via `mark_recipe_run`. **Recipe library** (below): the catalog. A catalog card whose `covers` tags are fully covered by an active user recipe shows "covered by your <recipe>" instead of "not installed" — deterministic tag intersection, no server reasoning.

Catalog:
- **Dawn agent** (flagship, `autopilot`, requires Garmin) — daily pass: sync yesterday → compute baselines + readiness gate (`log_derived_daily`) → update health threads (`add_health_event_update`) → write `briefings/YYYY-MM-DD.md`. Reads context from PROFILE/GOALS/PRINCIPLES rather than hardcoding it.
- Onboarding (user-triggered once) — fills PROFILE / GOALS / PRINCIPLES
- Morning check-in / Evening reflection (manual path for users without a wearable; the dawn agent supersedes them)
- Weekly review (reads `derived` rows), Race countdown, Health-log audit
- Garmin sync, Strava sync (sync-only; subsumed by the dawn agent)
- **Capacity sync** (`connector`, weekly, requires Garmin) — pulls slow-moving capacity (VO2max/LT/FTP/endurance/race-predictions) into `capacity_metrics`; refreshes `THRESHOLDS.md` + `RECORDS.md`
- **Insights scan** (`review`, weekly) — reads the statistics engine (correlations, trends, CTL/ATL/TSB, distributions) and writes a plain-language interpretation to `insights/YYYY-Www.md`: the "what to optimize" reasoning the app deliberately never does itself

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
- All DB access through Drizzle. Raw SQL only inside `supabase/migrations/` (Drizzle-generated). `.github/workflows/migrate.yml` runs `supabase db push` against production on any push to `main` that touches `supabase/migrations/**`; failures show up in commit checks. Requires `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` as repo secrets.
- Zod input schemas are declared **inline per tool file** (a record of validators alongside the tool — there is no `lib/schemas/` directory); validation happens at the MCP boundary.
- One MCP tool per file under `lib/mcp/tools/`. Tools are `(userId, input) => result` functions using `adminClient()` (service-role supabase-js scoped by `user_id`), **not** Drizzle/`ctx.db` — that's an aspirational note; the runtime path is supabase-js. Numeric columns deserialize as strings — coerce with `Number()`/`toFinite` before math.
- Tests via `vitest`. Each tool ships with at least one happy-path test and one validation-failure test.
- Memory file templates are markdown with embedded prompts (`<!-- Fill in: ... -->`) so users immediately know what each file is for.

## Build phases

**Phase 1 — MVP (manual capture).** Done. Schema + RLS, the MCP surface, OAuth AS + Supabase Auth, public signup, the marketing/login/`/data`/`/agents`/`/settings`/`/legal` surfaces, the recipe catalog, memory-template seeding.

**Phase 2 — Connector recipes.** Done as recipe authoring (Garmin sync, Strava sync). The user's dawn-agent supersedes the standalone sync recipes by also computing the derived layer and briefing.

**Phase 3 — Quality of life + intelligence layer.** In progress. The `/data` dashboard leads with a briefing-first **TodayHero** (renders the agent's readiness gate from `derived_daily`), active **health-event threads**, Timeline/Calendar/**Analyze** views (`?view=trends` aliases Analyze), a **briefings feed**, and the memory documents grid. The **Analyze** view + per-metric **drilldown** (`/data/metric/[key]`) are powered by the deterministic statistics engine (`get_correlation`/`_matrix`, `get_distribution`, `get_trend`, `get_load_balance`, `get_metric_series`) and shadcn/Recharts charts, with an **Insights** band rendering the `insights` recipe's prose. Capture expanded across all four domains (recovery, endurance, injury, body) via the new `daily_entries` columns, `workout_zones`, and `capacity_metrics`. The deterministic-stats-now / server-model-later seam is documented in *The load-bearing constraint*.

## Working notes

- **Migrations:** Drizzle (`lib/db/schema.ts`) is the source of truth → `pnpm drizzle-kit generate` → SQL in `supabase/migrations/`. RLS policies are hand-written follow-up SQL in the same migration (Drizzle doesn't manage RLS). The migrate workflow and the Vercel deploy race on push to `main`; keep new-table/column reads on `/data` tolerant of a not-yet-applied migration (`isMissingRelation` in `app/(app)/data/page.tsx`).
- **The passive line (enforced):** the app computes statistics (now incl. correlations, regressions, distributions, CTL/ATL/TSB) and renders Claude-authored judgments from `derived_daily`; it never authors a verdict. Charts render statistics only (r, R², slope, percentiles, load) — verdicts come only from `derived_daily` (the gate) and `insights/` prose. The dashboard's `TodayHero` shows signals only when no derived row exists — it does not invent a gate. UI-side z-score helpers (`lib/data-display/anomalies.ts`) are descriptive day-badges / fallback, never a competing verdict.
- **Charts are a hybrid.** Inline/glanceable micro-charts stay hand-rolled server-rendered SVG (`components/data/{sparkline,bar-stack,gate-strip}.tsx`) — zero client JS. The **Analyze view** (`?view=analyze`) and the **per-metric drilldown** (`/data/metric/[key]`) use **shadcn charts (Recharts v3)**: `components/ui/chart.tsx` + `components/data/charts/*`, `"use client"`, with data fetched and **all statistics computed server-side** (`lib/data-display/statistics.ts` / `metric-series.ts`) and passed as plain props. `CorrelationHeatmap` stays a server CSS-grid `<table>` by design (Recharts has no heatmap primitive). This is a deliberate, scoped departure from the old zero-client-JS rule. Markdown is `components/data/markdown.tsx` (react-markdown + remark-gfm).

## Pointers

- Architectural rationale: `docs/architecture.md`
- Schema + RLS policies: `docs/schema.md`
- MCP tools spec: `docs/mcp-tools.md`
- Recipe spec + starter prompts: `docs/recipes.md`
- Memory file templates (created during scaffold): `lib/memory/templates/`
