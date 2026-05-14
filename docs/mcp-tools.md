# MCP Tools

The MCP surface the BI server exposes. All tools are authenticated via OAuth bearer token. None of them accept a `user_id` argument — RLS handles scoping automatically based on the resolved token.

The surface covers full CRUD for every entity:

- **Capture (insert / upsert):** `log_workout`, `log_daily`, `log_meal`, `log_health_event`, `fs_write`
- **Update by id:** `update_workout`, `update_meal`, `update_health_event` (no `update_daily_entry` — `log_daily` already serves as both create and update via the `(user, date)` upsert)
- **Delete:** `delete_workout`, `delete_daily_entry`, `delete_meal`, `delete_health_event`, `fs_delete`
- **Filesystem ops:** `fs_move` (rename / relocate a document)
- **Read:** `fs_read`, `fs_list` (files + folders), `fs_search`, `get_recent`, `search_everything`
- **Direct getters:** `get_workout(id)`, `get_meal(id)`, `get_daily(date)`, `get_health_event(id)`
- **Range queries:** `list_workouts`, `list_meals`, `list_daily`, `list_health_events` (cursor-paginated, 200/page)
- **Bulk writes:** `bulk_log_workouts`, `bulk_log_daily`, `bulk_log_meals` (up to 500/call, returns `{ inserted, updated, errors[] }`)
- **Stats:** `get_baseline(metric, window_days)`, `get_stats(metric, from, to, agg)`, `get_streak(kind)`, `compute_training_load(days)`
- **Calendar rollup:** `get_calendar(year, month)` returns per-day rollups
- **Health events:** `resolve_health_event(id, resolved_date?)` (alias around `update_health_event`)
- **Recipes:** `list_recipes(include_install_state?)`, `get_recipe_status(recipe_id)`, `mark_recipe_run(recipe_id, status, error?)`
- **Connectors:** `list_connectors` (derived from `source` columns — BI does not hold connector credentials; no `trigger_sync`)
- **Onboarding:** `get_setup_guide`

`update_*` and `delete_*` tools take the entity's `id` (find it via `get_recent` or `search_everything`). They both throw if no row matches the id under the calling user — there's no silent no-op. Prefer `update_*` over `delete_*` when correcting bad data, so history stays intact.

## Tool registry shape

```ts
type ToolContext = {
  db: DrizzleClient;
  userId: string;
};

type Tool<I, O> = {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<I>;
  handler: (input: I, ctx: ToolContext) => Promise<O>;
};
```

`lib/mcp/server.ts` exports a `tools` array of these. The MCP server bootstrap iterates the array, registers each one with `@modelcontextprotocol/sdk`, and mounts the result at `/api/mcp`.

---

## Capture tools

### `log_workout`

Insert or upsert a workout. Manual writes (no `source_id`) always insert a new row; connector-driven writes (with `source_id`) upsert on the unique `(user_id, source, source_id)` key for idempotency across recipe re-runs.

**Input:**
```ts
{
  date: string;              // ISO date "YYYY-MM-DD"
  type: string;              // free-form: "tempo run", "brick", "leg day"
  duration_min?: number;
  distance_km?: number;
  avg_hr?: number;
  max_hr?: number;
  rpe?: number;              // 1-10
  shoes?: string;
  notes?: string;
  source?: string;           // default "manual". Connector recipes pass "garmin", "strava", etc.
  source_id?: string;        // optional. When provided, makes the write idempotent.
}
```

**Output:** the created or updated workout row, plus a flag indicating which: `{ row, action: "inserted" | "updated" }`.

**Notes:**
- BI is integration-agnostic. Whoever calls this tool — a human via Claude, a connector recipe, or a future PWA — uses the same signature. No internal "connector path" exists.
- For idempotency: a Garmin sync recipe should always pass `source: "garmin"` and `source_id: "<garmin activity id>"`. Re-running the recipe on the same activity updates the existing row rather than creating a duplicate.
- Manual entries (no `source_id`) always insert. Two manual workouts on the same date with the same fields will create two rows — that's intentional, since it might represent a doubles day where the user didn't bother distinguishing them.

---

### `update_workout`

Patch fields on an existing workout by id. Only the fields you pass are touched; the rest are preserved. Use this for after-the-fact corrections (wrong distance logged, RPE filled in later, notes clarified). Find the id via `get_recent` or `search_everything`.

**Input:**
```ts
{
  id: string;                // workout uuid
  date?: string;
  type?: string;
  duration_min?: number | null;
  distance_km?: number | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  rpe?: number | null;
  shoes?: string | null;
  notes?: string | null;
}
```

Pass `null` explicitly to clear a previously-set value. Omitting a key leaves it untouched.

**Output:** the updated workout row.

**Errors:** throws `"update_workout: workout <id> not found"` if no row matches the id under the calling user.

---

### `delete_workout`

Hard delete a workout row by id. Irreversible. Prefer `update_workout` over `delete_workout` when correcting bad data — deleting loses the historical trail.

**Input:** `{ id: string }`

**Output:** `{ id, deleted: true }`

---

### `log_daily`

Upsert the daily entry for `(user_id, date)`. Partial fields are allowed — calling with only `{ date, sleep_h, hrv_ms }` updates those fields and leaves the rest untouched.

**Input:**
```ts
{
  date: string;              // ISO date
  // Sleep
  sleep_h?: number;          // total sleep hours
  sleep_deep_min?: number;   // minutes in deep stage
  sleep_light_min?: number;
  sleep_rem_min?: number;
  sleep_awake_min?: number;
  // Cardio vitals
  hrv_ms?: number;           // overnight HRV (rMSSD) in ms
  rhr_bpm?: number;          // resting heart rate
  spo2_avg_pct?: number;     // overnight blood-oxygen avg
  respiration_avg_brpm?: number; // overnight respiration avg
  // Body composition
  weight_kg?: number;
  body_fat_pct?: number;     // smart-scale body fat %
  // Movement totals (the day's accumulated activity)
  steps?: number;
  active_calories?: number;  // kcal above BMR
  floors_climbed?: number;
  intensity_min_moderate?: number; // WHO-standard moderate-intensity minutes
  intensity_min_vigorous?: number; // WHO-standard vigorous-intensity minutes
  // Subjective wellness (5 = best, always)
  fatigue?: 1|2|3|4|5;       // 5 = freshest
  soreness?: 1|2|3|4|5;      // 5 = least sore
  mood?: 1|2|3|4|5;          // 5 = best
  stress?: 1|2|3|4|5;        // 5 = least stressed
  motivation?: 1|2|3|4|5;    // 5 = highest
  sleep_quality?: 1|2|3|4|5; // 5 = best
  // Free-text
  sleep_notes?: string;
  wellness_notes?: string;
  meal_notes?: string;
}
```

**Output:** the resulting daily_entries row (after upsert).

**Notes:**
- All wellness scales follow the **5 = best** convention. This is non-negotiable — recipe prompts and `get_recent` synthesis rely on it.
- If the row exists, `updated_at` is set to `now()`. If it didn't exist, `created_at` and `updated_at` are both `now()`.
- There is no `update_daily_entry`. `log_daily` is also the update path — call it again with any subset of fields and only those change.

---

### `delete_daily_entry`

Hard delete the `daily_entries` row for a given date. Irreversible. Prefer calling `log_daily` again with corrected values when fixing bad data; reach for delete only when the whole row should be gone (e.g. accidental entry for a future date).

**Input:** `{ date: string }` (YYYY-MM-DD)

**Output:** `{ id, date, deleted: true }`

**Errors:** throws if no daily entry exists for that date.

---

### `log_meal`

Insert or upsert a meal. Manual writes (no `source_id`) always insert a new row; connector-driven writes (with `source_id`) upsert on the unique `(user_id, source, source_id)` key for idempotency across recipe re-runs.

**Input:**
```ts
{
  eaten_at: string;          // ISO timestamp. With offset (`2026-05-08T08:30:00+02:00`) preferred; bare `YYYY-MM-DDTHH:mm:ss` is resolved against the user's timezone.
  meal_type?: string;        // free-form: "breakfast", "lunch", "snack", "pre-run", "post-workout"
  description: string;       // required: what was eaten, in prose
  calories: number;          // REQUIRED — estimate from description if no authoritative source
  protein_g: number;         // REQUIRED — estimate if not known
  carbs_g: number;           // REQUIRED — estimate if not known
  fat_g: number;             // REQUIRED — estimate if not known
  fiber_g?: number;          // optional
  notes?: string;
  source?: string;           // default "manual". Connector recipes pass "mfp", "cronometer", "apple_health", etc.
  source_id?: string;        // optional. When provided, makes the write idempotent.
}
```

**Output:** the created or updated meal row, plus a flag indicating which: `{ row, action: "inserted" | "updated" }`.

**Notes:**
- `description`, `calories`, `protein_g`, `carbs_g`, and `fat_g` are all required. When the caller does not have authoritative numbers (food label, connector payload, weighed portion), it MUST estimate from the description before writing. Skipping the write because macros are uncertain is wrong — an estimate is the expected behaviour. `fiber_g` stays optional.
- Manual logging is high-friction; expect this tool to fill mostly via Phase 2 connector recipes (MyFitnessPal, Cronometer, Apple Health). The `source` + `source_id` pattern matches `log_workout` exactly so connector authoring stays consistent across both.
- BI does not split a meal into per-food rows. If a connector source has food-level granularity, the recipe is responsible for flattening to per-meal totals before calling this tool. Per-food modeling would require a foods catalog and adds schema-vs-payoff debt that v1 explicitly avoids.

---

### `update_meal`

Patch fields on an existing meal by id. Pass any subset of fields; only those change. Unlike `log_meal`, macro fields are NOT required here — this tool is for fixing existing rows, so a partial patch can update just the description without re-asserting macros. Pass `null` explicitly to clear a stale value.

**Input:**
```ts
{
  id: string;                // meal uuid
  eaten_at?: string;
  meal_type?: string | null;
  description?: string;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  notes?: string | null;
}
```

**Output:** the updated meal row.

---

### `delete_meal`

Hard delete a meal row by id. Irreversible.

**Input:** `{ id: string }`

**Output:** `{ id, deleted: true }`

---

### `log_health_event`

Insert a row in `health_events`.

**Input:**
```ts
{
  date: string;              // when the event began or was logged
  kind: "injury" | "illness" | "symptom";
  body_part?: string;        // free-form: "L knee", "lower back"
  severity?: 1|2|3|4|5;      // 5 = most severe (note: OPPOSITE direction from wellness)
  notes?: string;            // mechanism, sensations
  resolved_date?: string;    // optional ISO date if logging retrospectively
}
```

**Output:** the created row.

**Notes:**
- This is the only entity with a 1–5 scale that doesn't follow the "5 = best" convention. Health events are inherently bad, so 5 = worst makes more sense at the call site.
- To mark an event resolved, call `update_health_event` with `resolved_date`. Qualitative narrative still lives in `HEALTH_LOG.md` via `fs_write`.

---

### `update_health_event`

Patch fields on an existing health event by id. This is also the resolution path — pass `resolved_date` with the date the issue cleared. Pass `resolved_date: null` to re-open a previously-resolved event.

**Input:**
```ts
{
  id: string;
  date?: string;
  kind?: "injury" | "illness" | "symptom";
  body_part?: string | null;
  severity?: number | null;
  notes?: string | null;
  resolved_date?: string | null;  // ISO date or null to re-open
}
```

**Output:** the updated health_events row.

---

### `delete_health_event`

Hard delete a health event row by id. Irreversible. Prefer `update_health_event` with `resolved_date` when an event is simply over — deletion loses the history entirely. Reach for delete only when the event was logged in error.

**Input:** `{ id: string }`

**Output:** `{ id, deleted: true }`

---

### `fs_write`

Upsert a memory document.

**Input:**
```ts
{
  path: string;              // e.g. "PROFILE.md", "PRINCIPLES.md", custom paths allowed
  content: string;           // full document content (no patch semantics in v1)
}
```

**Output:** the resulting document row (with `updated_at`).

**Notes:**
- Full-document writes only in v1. Patch semantics (line-level edits) are a Phase 3 consideration.
- Paths are slash-separated and must end in `.md`. Folders are implicit — writing to `notes/2026/altitude-camp.md` creates the file directly; no folder record needed. Standard top-level paths are the eight seeded memory files; everything else is freeform (encouraged to use nested folders for organization).
- Path is normalized: trim whitespace, no leading or trailing slash, no `..`, no empty path segments, no hidden segments starting with `.`.

---

### `fs_delete`

Hard delete a memory document by path. Irreversible. The eight standard memory files are only seeded once on signup — deleting one will not bring it back. Prefer `fs_write` with replacement content when the file should keep existing.

**Input:** `{ path: string }`

**Output:** `{ path, deleted: true }`

**Errors:** throws if no document exists at that path under the calling user.

---

### `fs_move`

Atomically rename or relocate a markdown document. Useful for organizing files into folders or correcting a name after the fact.

**Input:**
```ts
{
  from_path: string;         // existing path
  to_path: string;           // new path (must not already exist)
}
```

**Output:** `{ path, updated_at, moved: boolean }` — `moved: false` if `from_path === to_path` (no-op).

**Errors:**
- throws if `from_path` doesn't exist
- throws if `to_path` is already taken (delete the destination first, or pick another name)

**Notes:**
- v1 moves a single file. Bulk folder rename (`notes/x/` → `notes/y/`) is done by enumerating with `fs_list({ prefix: "notes/x/" })` and moving each file.

---

## Read tools

### `fs_read`

Read a memory document.

**Input:**
```ts
{ path: string }
```

**Output:** `{ path, content, updated_at }` or null if the document doesn't exist.

---

### `fs_list`

List the user's virtual filesystem. Returns both files and derived folders.

**Input:**
```ts
{ prefix?: string }            // optional path prefix to scope the listing
```

**Output:**
```ts
{
  files: Array<{ path: string; updated_at: string }>;
  folders: Array<{ path: string; file_count: number }>;  // ends in /
}
```

`files` is sorted alphabetically by path. `folders` lists distinct directory prefixes derived from the file paths (a folder exists iff it contains at least one file, possibly nested). File counts are recursive — `notes/` reports the total number of files under it, including everything in subfolders.

**Notes:**
- Returns metadata only (no content) to keep responses small.
- Prefix scopes the result to a subtree. Use `prefix: "notes/"` to list one folder; omit it to list the whole filesystem.
- Prefix is matched literally — SQL `LIKE` wildcards `%` and `_` are escaped, so users can have files with those characters in their paths.

---

### `fs_search`

Full-text search over document content.

**Input:**
```ts
{ query: string; limit?: number }   // default limit 20, max 100
```

**Output:** `Array<{ path, snippet, updated_at }>`. `snippet` is a 200-char excerpt around the first match.

Backed by the GIN index on `to_tsvector('english', content)`.

---

### `get_recent`

Bundle recent rows across multiple entity tables. Used by nearly every Claude reasoning task that starts with "what's been going on lately."

**Input:**
```ts
{
  days: number;                                   // 1-90
  kinds?: Array<"workouts" | "daily" | "meals" | "health_events">; // default: all four
}
```

**Output:**
```ts
{
  workouts: WorkoutRow[];           // ordered by date desc
  daily: DailyEntryRow[];           // ordered by date desc
  meals: MealRow[];                 // ordered by eaten_at desc
  health_events: HealthEventRow[];  // ordered by date desc, includes unresolved older than `days`
}
```

**Notes:**
- `health_events` returns unresolved events even if their `date` is older than the window. Active injuries shouldn't disappear from "recent" just because they've been around a while.

---

### `search_everything`

Text search across all entity tables and documents.

**Input:**
```ts
{ query: string; limit?: number }   // default 20, max 100
```

**Output:**
```ts
Array<{
  kind: "workout" | "daily_entry" | "meal" | "health_event" | "document";
  id: string;
  date?: string;        // for entity rows (`eaten_at` date for meals)
  path?: string;        // for documents
  snippet: string;      // matched excerpt
  updated_at: string;
}>
```

Implementation: union five separate full-text queries (workouts, daily_entries, meals, health_events, documents) and merge by `updated_at` desc with limit applied at the end.

---

## Validation conventions

- Use `drizzle-zod`'s `createInsertSchema` to derive base schemas, then `.pick()` and `.partial()` to shape each tool's input.
- Date strings: validate with `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`.
- Severity / wellness scales: `z.number().int().min(1).max(5)`.
- Path strings: regex `^[A-Za-z0-9_/.\-]+\.md$`. No leading slash. No `..`.

## Error conventions

Tools throw `BiError` with a `code` field:

- `INVALID_INPUT` — Zod validation failed (rare, since the registry pre-validates)
- `NOT_FOUND` — `fs_read` of a path that doesn't exist (this is returning null, not throwing — but if a future tool needs strict NOT_FOUND, use this)
- `UNAUTHORIZED` — bearer token missing or invalid (raised by the route handler before reaching the tool)
- `RATE_LIMITED` — reserved for future use
- `INTERNAL` — anything else; logged with details server-side, returned generically

The MCP server adapter translates these to MCP error responses with the appropriate JSON-RPC error codes.
