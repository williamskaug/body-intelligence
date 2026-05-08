# Schema

Postgres schema for Body Intelligence. Drizzle is the source of truth — this document mirrors what `lib/db/schema.ts` will declare. RLS policies live alongside the tables in Drizzle migrations.

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
| `sleep_h` | `numeric(4,2)` | hours |
| `hrv_ms` | `integer` | morning HRV |
| `rhr_bpm` | `integer` | resting heart rate |
| `weight_kg` | `numeric(5,2)` | |
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

A Postgres trigger on `auth.users` insert calls a function that inserts the eight standard documents from `lib/memory/templates/`. Templates are read at app startup and cached. The trigger writes them with the new user's `user_id` and the standard path.

Alternative: do this in a Next.js post-signup hook instead of a Postgres trigger. Either works; the trigger is more robust against the app missing the signup event.
