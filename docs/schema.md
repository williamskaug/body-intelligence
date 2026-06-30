# Schema

Postgres schema for Body Intelligence. Drizzle is the source of truth — this document mirrors what `lib/db/schema.ts` will declare. RLS policies live alongside the tables in Drizzle migrations.

> **Iteration 2 changes:**
> - `meals.calories`, `protein_g`, `carbs_g`, `fat_g` are now **NOT NULL** (run `scripts/backfill-meal-macros.ts` before applying the migration on existing data). _Superseded by iteration 3 — nutrition is de-scoped; the NOT-NULL follow-up was abandoned and the columns stay nullable._
> - New `installed_recipes` table mirrors Cowork-side recipe install + run state (see "Tables" below).
> - `daily_entries` already carried the four `sleep_*_min` columns; iteration 2 added a setup-guide rule + `scripts/backfill-sleep-stages.ts` to ensure those columns are actually populated rather than dumped into `sleep_notes` prose.

> **Iteration 3 — derived layer + threads (migrations `20260612144914_derived_layer` + `..._workout_type_backfill`):**
> - **`derived_daily`** — agent-computed readiness gate, illness composite + per-signal flags, `hrv_z`/`rhr_z`/`sleep_z`, `sleep_debt_7d_min`, `sleep_need_min`, `acute_load_7d`, `chronic_load_28d`, `days_to_race`, provenance. One row per (user, date), unique. **Full-row replace** on write — BI never computes it; the user's scheduled agent does, via `log_derived_daily`.
> - **`workout_metrics`** — optional 1:1 side table keyed by `workout_id` for running dynamics / TE / stamina / durability (`date` denormalized for range trends). Lap splits stay in `daily/*.md`.
> - **`health_event_updates`** — dated thread updates (`event_id`, `date`, `note`, `severity_at_time`); `health_events` gained `next_milestone` + `next_milestone_date`. Replaces appending "STATUS …" blocks into `health_events.notes`.
> - `daily_entries` gained `skin_temp_deviation_c` and `sleep_score` (cross-vendor vitals; Body Battery / Training Readiness stay in `daily/*.md`).
> - `workouts.type` canonicalized via a one-time backfill; new writes normalize through `normalizeWorkoutType` (`lib/mcp/tools/shared.ts`). No CHECK constraint — unknown types pass through lowercased + snake_cased.
> - RLS owner policies on all three new tables, in the same migration.

## Conventions

- Primary keys: `uuid` generated via `gen_random_uuid()` unless noted.
- Timestamps: `timestamptz`, default `now()`.
- Free-text fields: `text` (no length limit). Premature limits cause friction.
- Foreign keys to `auth.users` are named `user_id` and are `not null`.
- Every table has RLS enabled and policies scoped to `auth.uid() = user_id`.

## Tables

### `user_profiles`

One row per user, seeded on signup. Holds the small set of per-user knobs the rest of the app needs.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | FK `auth.users(id)`, unique |
| `display_name` | `text` | shown on `/settings`; defaults to email local-part on seed |
| `timezone` | `text not null default 'UTC'` | IANA TZ name (e.g. `Europe/Oslo`). Recipes resolve "today" via this. |
| `units_system` | `text not null default 'metric'` | `metric` \| `imperial`. DB always stores canonical metric; UI/Claude convert at the boundary. |
| `locale` | `text not null default 'en'` | reserved for future i18n |
| `preferences` | `jsonb not null default '{}'` | forward-compat blob for additional knobs (notification cadence, default views, etc.) — avoids re-migrating for every small toggle |
| `created_at` | `timestamptz default now()` | |
| `updated_at` | `timestamptz default now()` | |

Constraints: `unique (user_id)`. RLS scoped to `user_id = auth.uid()`.

Seeded by the same trigger that seeds the eight standard documents.

### `workouts`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | FK `auth.users(id)` |
| `date` | `date not null` | local date the workout occurred |
| `type` | `text not null` | free-form: `"tempo run"`, `"brick"`, `"leg day"` |
| `duration_min` | `integer` | nullable — strength workouts may not have a clean duration |
| `distance_km` | `numeric(6,2)` | nullable |
| `avg_hr` | `integer` | bpm |
| `max_hr` | `integer` | bpm |
| `rpe` | `smallint` | 1–10, subjective |
| `shoes` | `text` | shoe identifier (`"gel-trabuco-12"`) — joins to `EQUIPMENT.md` qualitatively |
| `source` | `text not null default 'manual'` | free-form: `manual`, `garmin`, `strava`, `apple_health`, `whoop`, etc. |
| `source_id` | `text` | nullable — idempotency key from the source (e.g. Garmin activity ID). Required for connector writes; null for manual writes. |
| `notes` | `text` | free prose |
| `created_at` | `timestamptz default now()` | |
| `updated_at` | `timestamptz default now()` | |

Indexes: `(user_id, date desc)`, `(user_id, created_at desc)`.

Constraints: `unique (user_id, source, source_id) where source_id is not null`. This makes connector-driven writes idempotent across recipe re-runs while leaving manual writes unconstrained (you can log two manual workouts on the same date without hitting a unique violation).

### `daily_entries`

One row per (user, date).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | FK `auth.users(id)` |
| `date` | `date not null` | unique with `user_id` |
| `sleep_h` | `numeric(4,2)` | total sleep hours |
| `sleep_deep_min` | `integer` | minutes in deep stage |
| `sleep_light_min` | `integer` | minutes in light stage |
| `sleep_rem_min` | `integer` | minutes in REM |
| `sleep_awake_min` | `integer` | minutes awake during sleep window |
| `hrv_ms` | `integer` | morning HRV (rMSSD) |
| `rhr_bpm` | `integer` | resting heart rate |
| `spo2_avg_pct` | `numeric(4,1)` | overnight blood-oxygen average |
| `respiration_avg_brpm` | `numeric(4,1)` | overnight respiration (breaths/min) |
| `weight_kg` | `numeric(5,2)` | |
| `body_fat_pct` | `numeric(4,1)` | smart-scale body fat % |
| `steps` | `integer` | daily total |
| `active_calories` | `integer` | kcal above BMR |
| `floors_climbed` | `integer` | |
| `intensity_min_moderate` | `integer` | WHO-standard moderate minutes |
| `intensity_min_vigorous` | `integer` | WHO-standard vigorous minutes |
| `fatigue` | `smallint` | 1–5, **5 = freshest** |
| `soreness` | `smallint` | 1–5, **5 = least sore** |
| `mood` | `smallint` | 1–5, **5 = best** |
| `stress` | `smallint` | 1–5, **5 = least stressed** |
| `motivation` | `smallint` | 1–5, **5 = highest** |
| `sleep_quality` | `smallint` | 1–5, **5 = best** |
| `sleep_notes` | `text` | |
| `wellness_notes` | `text` | |
| `meal_notes` | `text` | free-form list of meals; macros/calories optional in prose |
| `created_at` | `timestamptz default now()` | |
| `updated_at` | `timestamptz default now()` | |

Constraints: `unique (user_id, date)`. Check constraints on the 1–5 scales: `between 1 and 5`.

Indexes: `(user_id, date desc)`.

### `meals`

One row per meal. Per-meal capture so recipes can aggregate calories/macros over time and correlate intake with workouts and wellness scales.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | FK `auth.users(id)` |
| `eaten_at` | `timestamptz not null` | meal timing matters for fasting windows, pre/post-workout fueling |
| `meal_type` | `text` | free-form: `"breakfast"`, `"lunch"`, `"snack"`, `"pre-run"`, `"post-workout"` |
| `description` | `text not null` | what was eaten, in prose: `"oatmeal, banana, almond butter"` |
| `calories` | `integer` | nullable |
| `protein_g` | `numeric(6,2)` | nullable |
| `carbs_g` | `numeric(6,2)` | nullable |
| `fat_g` | `numeric(6,2)` | nullable |
| `fiber_g` | `numeric(6,2)` | nullable |
| `notes` | `text` | how it felt, "skipped a gel", etc. |
| `source` | `text not null default 'manual'` | free-form: `manual`, `mfp`, `cronometer`, `apple_health`, etc. |
| `source_id` | `text` | nullable — idempotency key from the source. Required for connector writes; null for manual writes. |
| `created_at` | `timestamptz default now()` | |
| `updated_at` | `timestamptz default now()` | |

Indexes: `(user_id, eaten_at desc)`.

Constraints: `unique (user_id, source, source_id) where source_id is not null` — same idempotency pattern as `workouts`. Manual entries (no `source_id`) always insert, so two manual snacks with identical fields are allowed.

**Coexistence with other surfaces:**
- `daily_entries.meal_notes` stays — it's the day's free-text reflection ("felt heavy after lunch"), different grain.
- `NUTRITION.md` stays — it's the dietary philosophy ("oatmeal pre-long-run works, gels above 80 min don't"). Same relationship `HEALTH_LOG.md` has to `health_events` and `PRINCIPLES.md` has to `workouts`.

Macro fields are nullable on purpose: manual per-meal logging is usually description-only. Macros fill in via Phase 2 connector recipes (MyFitnessPal, Cronometer, Apple Health) where the source already has them.

### `health_events`

Append-only log. Active issues = `resolved_date is null`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | FK `auth.users(id)` |
| `date` | `date not null` | when the event was logged or began |
| `kind` | `text not null` | `injury` \| `illness` \| `symptom` |
| `body_part` | `text` | `"L knee"`, `"lower back"` — free-form |
| `severity` | `smallint` | 1–5, **5 = most severe** (note: opposite direction from wellness scales — events are bad) |
| `notes` | `text` | mechanism, sensations, what made it better/worse |
| `resolved_date` | `date` | nullable |
| `created_at` | `timestamptz default now()` | |
| `updated_at` | `timestamptz default now()` | |

Indexes: `(user_id, date desc)`, partial index `(user_id) where resolved_date is null` for fast active-issue queries.

### `documents`

Virtual filesystem for memory files. Standard paths are seeded on user creation; users can `fs_write` to additional paths.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | FK `auth.users(id)` |
| `path` | `text not null` | unique with `user_id`. Standard: `MEMORY.md`, `PROFILE.md`, `PRINCIPLES.md`, `GOALS.md`, `CURRENT.md`, `HEALTH_LOG.md`, `NUTRITION.md`, `EQUIPMENT.md` |
| `content` | `text not null` | markdown |
| `created_at` | `timestamptz default now()` | |
| `updated_at` | `timestamptz default now()` | |

Constraints: `unique (user_id, path)`.

Indexes: `(user_id, path)` covers both lookup and listing.

For text search, add a GIN index on `to_tsvector('english', content)` to back `fs_search`.

### `oauth_clients`

DCR-registered clients (typically one per Cowork install).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `client_id` | `text not null unique` | DCR-issued |
| `client_secret_hash` | `text` | nullable — public clients (PKCE-only) won't have one |
| `name` | `text not null` | client-supplied at registration ("Cowork on William's MBP") |
| `redirect_uris` | `text[] not null` | array of allowed redirect URIs |
| `created_at` | `timestamptz default now()` | |

Indexes: `client_id` (unique).

### `oauth_tokens`

Issued tokens. Hashed at rest using HMAC-SHA256 with `OAUTH_SIGNING_SECRET`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null` | FK `auth.users(id)` |
| `client_id` | `text not null` | FK `oauth_clients(client_id)` |
| `access_token_hash` | `text not null` | unique |
| `refresh_token_hash` | `text not null unique` | |
| `access_expires_at` | `timestamptz not null` | |
| `refresh_expires_at` | `timestamptz not null` | |
| `scopes` | `text[] not null default '{}'` | reserved for future scoping |
| `revoked_at` | `timestamptz` | nullable |
| `last_used_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz default now()` | |

Indexes: `access_token_hash` (unique), `refresh_token_hash` (unique), `(user_id, revoked_at)` partial where `revoked_at is null`.

## RLS policies

Enable RLS on every user-scoped table:

```sql
alter table workouts enable row level security;
alter table daily_entries enable row level security;
alter table meals enable row level security;
alter table health_events enable row level security;
alter table documents enable row level security;
alter table oauth_tokens enable row level security;
```

For each, the canonical policy:

```sql
create policy "users see own rows"
  on <table>
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

`oauth_clients` is **not** RLS-scoped — it's a global registry; the client_id itself is the lookup key, and clients aren't user-scoped (one client can serve multiple users via different tokens).

## Auth wiring

The MCP route handler verifies the bearer token by:
1. Computing `hash = hmac_sha256(token, OAUTH_SIGNING_SECRET)`
2. Looking up `oauth_tokens` by `access_token_hash`
3. Checking `access_expires_at > now()` and `revoked_at is null`
4. Setting the request's Postgres role to authenticated, with `request.jwt.claim.sub = user_id`

Once `auth.uid()` is set, all subsequent Drizzle queries are automatically scoped by RLS. **Tools never accept a `user_id` argument.**

## Document seeding on signup

A Postgres trigger on `auth.users` insert calls a function that inserts the ten standard documents from `lib/memory/templates/` (the original eight plus `THRESHOLDS.md` and `RECORDS.md`). Templates are read at app startup and cached. The trigger writes them with the new user's `user_id` and the standard path.

Alternative: do this in a Next.js post-signup hook instead of a Postgres trigger. Either works; the trigger is more robust against the app missing the signup event.

## Iteration 4 — capture expansion (statistical redesign)

Additive migration `supabase/migrations/*_capture_expansion.sql`. No drops, no
NOT-NULL flips, no type changes — old code stays valid against the new DB during
the migrate↔deploy race.

- `daily_entries` new columns: `stress_score`, `body_battery_morning/high/low/charged/drained`,
  `training_readiness_score` (all smallint 0–100), `training_status` (text, **no
  CHECK**), `muscle_mass_kg`, `bone_mass_kg`, `body_water_pct`, `bp_systolic_mmhg`,
  `bp_diastolic_mmhg`, `hydration_ml`. Range CHECKs in the `daily_*_range` style.
- `workout_metrics` new columns: `weather_temp_c`, `weather_humidity_pct`,
  `strength_volume_kg`.
- New table `workout_zones` (1:1 by `workout_id`, denormalized `date`):
  `hr_z1_s…hr_z5_s`, `power_z1_s…power_z7_s` (seconds, `>= 0` CHECKs). RLS owner
  policy hand-appended.
- New table `capacity_metrics` (wide, unique `(user_id, date)`): VO2max run/bike,
  lactate threshold (HR / pace s·km⁻¹ / power W), `cycling_ftp_w`,
  `endurance_score`, `hill_score`, `fitness_age_years`, `running_tolerance_km`,
  race predictions (5k/10k/half/marathon, seconds). Range/positivity CHECKs; RLS
  owner policy hand-appended.

The metric registry (`lib/mcp/tools/metrics.ts`) gains `WORKOUT_ZONE_METRICS` and
`CAPACITY_METRICS`; `resolveMetric` routes `capacity_*` and the `workout_*` zone
keys **before** the `workouts` fallthrough.
