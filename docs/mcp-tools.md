# MCP Tools

The eight-tool surface that the BI MCP server exposes. All tools are authenticated via OAuth bearer token. None of them accept a `user_id` argument — RLS handles scoping automatically based on the resolved token.

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

### `log_daily`

Upsert the daily entry for `(user_id, date)`. Partial fields are allowed — calling with only `{ date, sleep_h, hrv_ms }` updates those fields and leaves the rest untouched.

**Input:**
```ts
{
  date: string;              // ISO date
  sleep_h?: number;
  hrv_ms?: number;
  rhr_bpm?: number;
  weight_kg?: number;
  fatigue?: 1|2|3|4|5;       // 5 = freshest
  soreness?: 1|2|3|4|5;      // 5 = least sore
  mood?: 1|2|3|4|5;          // 5 = best
  stress?: 1|2|3|4|5;        // 5 = least stressed
  motivation?: 1|2|3|4|5;    // 5 = highest
  sleep_quality?: 1|2|3|4|5; // 5 = best
  sleep_notes?: string;
  wellness_notes?: string;
  meal_notes?: string;
}
```

**Output:** the resulting daily_entries row (after upsert).

**Notes:**
- All wellness scales follow the **5 = best** convention. This is non-negotiable — recipe prompts and `get_recent` synthesis rely on it.
- If the row exists, `updated_at` is set to `now()`. If it didn't exist, `created_at` and `updated_at` are both `now()`.

---

### `log_meal`

Insert or upsert a meal. Manual writes (no `source_id`) always insert a new row; connector-driven writes (with `source_id`) upsert on the unique `(user_id, source, source_id)` key for idempotency across recipe re-runs.

**Input:**
```ts
{
  eaten_at: string;          // ISO timestamp. With offset (`2026-05-08T08:30:00+02:00`) preferred; bare `YYYY-MM-DDTHH:mm:ss` is resolved against the user's timezone.
  meal_type?: string;        // free-form: "breakfast", "lunch", "snack", "pre-run", "post-workout"
  description: string;       // required: what was eaten, in prose
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  notes?: string;
  source?: string;           // default "manual". Connector recipes pass "mfp", "cronometer", "apple_health", etc.
  source_id?: string;        // optional. When provided, makes the write idempotent.
}
```

**Output:** the created or updated meal row, plus a flag indicating which: `{ row, action: "inserted" | "updated" }`.

**Notes:**
- `description` is the only required field. A user logging "ate ramen" with no macros is a valid call — macros are nice-to-have, not required.
- Manual logging is high-friction; expect this tool to fill mostly via Phase 2 connector recipes (MyFitnessPal, Cronometer, Apple Health). The `source` + `source_id` pattern matches `log_workout` exactly so connector authoring stays consistent across both.
- BI does not split a meal into per-food rows. If a connector source has food-level granularity, the recipe is responsible for flattening to per-meal totals before calling this tool. Per-food modeling would require a foods catalog and adds schema-vs-payoff debt that v1 explicitly avoids.

---

### `log_health_event`

Insert a row in `health_events`. Append-only.

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
- To mark an event resolved later, the user calls this tool again — but **no, they don't**. Resolution happens via a separate flow: either `fs_write` to `HEALTH_LOG.md` (qualitative resolution note) or a future `update_health_event` tool. For Phase 1, resolution is implicit (the user just stops mentioning it) and `HEALTH_LOG.md` carries the qualitative narrative.

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
- Path is normalized: trim whitespace, no leading slashes, no path traversal segments. Reject anything containing `..` or `\0`.

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

List documents. Optional prefix filter.

**Input:**
```ts
{ prefix?: string }
```

**Output:** `Array<{ path, updated_at }>`. Sorted alphabetically by path.

**Notes:**
- Returns metadata only (no content) to keep responses small.
- Prefix is matched as `path like '<prefix>%'` — useful if users start namespacing custom docs (e.g. `notes/2026-05-camp.md`).

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
