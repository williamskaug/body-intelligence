import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResult } from "./tools/shared";
import { fsRead, fsReadInputSchema } from "./tools/fs-read";
import { fsWrite, fsWriteInputSchema } from "./tools/fs-write";
import { fsList, fsListInputSchema } from "./tools/fs-list";
import { fsSearch, fsSearchInputSchema } from "./tools/fs-search";
import { logWorkout, logWorkoutInputSchema } from "./tools/log-workout";
import { logDaily, logDailyInputSchema } from "./tools/log-daily";
import { logMeal, logMealInputSchema } from "./tools/log-meal";
import { logHealthEvent, logHealthEventInputSchema } from "./tools/log-health-event";
import { getRecent, getRecentInputSchema } from "./tools/get-recent";
import { searchEverything, searchEverythingInputSchema } from "./tools/search-everything";

export type McpContext = {
  userId: string;
  clientId: string;
};

const INSTRUCTIONS = `Body Intelligence (BI) is the user's personal health intelligence store —
workouts, daily wellness, meals, health events, and a markdown memory layer.
Same shape as Project Intelligence, but for the athlete-self.

# The passive principle

BI is a passive store. It holds data and returns data. It does NOT decide whether the
user should train, rest, take a recovery week, or push through. Those judgments are
yours, made by reasoning over the data plus the user's PRINCIPLES.md. Do not delegate
decisions to BI — there is no logic on the server side beyond CRUD.

# Data model

- workouts — one row per workout. Free-form type (run / lift / ride / yoga / …).
  Optional duration_min, distance_km, avg_hr, max_hr, rpe (1–10), shoes, notes.
- daily_entries — one row per (user, date). Sleep, HRV, RHR, weight, six 1–5
  wellness scales, plus three free-text blocks (sleep_notes, wellness_notes,
  meal_notes). Partial updates allowed.
- meals — one row per meal. eaten_at (timestamp), meal_type, required description,
  optional calories + macros. Day-level prose lives in daily_entries.meal_notes;
  dietary philosophy lives in NUTRITION.md.
- health_events — append-only log of injuries / illnesses / symptoms. kind is one of
  'injury' | 'illness' | 'symptom'. resolved_date null = still active.
- documents — virtual filesystem keyed by (user, path). Markdown content. Eight
  standard paths seeded on signup (see Memory layer below).

# Conventions — read these before writing

- Wellness scales (fatigue, soreness, mood, stress, motivation, sleep_quality) use
  5 = best, ALWAYS. Even for fatigue / soreness / stress — 5 means "no fatigue",
  "no soreness", "no stress". The naming is inverted relative to natural reading.
- health_events.severity is the OPPOSITE direction: 1–5 with 5 = most severe.
  This is the one place where 5 = bad. Don't confuse it with the wellness scales.
- rpe is 1–10 (standard Borg-style RPE), not 1–5.
- Idempotency: workouts and meals accept (source, source_id). Manual writes leave
  source_id null and always insert. Connector recipes (Garmin, Strava, MFP, …)
  set source='garmin' + source_id=<external id> so re-runs upsert cleanly.
- Dates are stored as DATE in the user's local sense — no timezone conversion on
  the server. eaten_at on meals is the only true timestamp.
- All writes are user-scoped automatically. Tools never accept a user_id argument.

# Memory layer

Eight standard markdown documents per user, seeded on signup:

- MEMORY.md     — one-line index over the other files
- PROFILE.md    — anthropometrics, training history, equipment
- PRINCIPLES.md — training philosophy; the decision rules you reason against
- GOALS.md      — A/B/C races, performance benchmarks
- CURRENT.md    — this week's plan, active block, next race
- HEALTH_LOG.md — narrative history of injuries / illnesses / niggles
- NUTRITION.md  — what works, what wrecks them, dietary preferences
- EQUIPMENT.md  — gear inventory, mileage, condition

Custom paths are allowed (e.g. 'notes/2026-altitude-camp.md', 'daily/2026-05-11.md').

Two format conventions matter because recipes parse them:
- GOALS.md race blocks: '## Race: <name>' then '- Date: YYYY-MM-DD' + Tier/Distance/Goal/Notes.
- HEALTH_LOG.md events: '## YYYY-MM-DD — <body part> — <kind>' then Mechanism/Severity/Treatment/Resolution/Lessons.

Per-day vendor data (Garmin / Whoop / Oura proprietary scores like Body Battery,
Recovery, Readiness) goes into 'daily/YYYY-MM-DD.md' via fs_write — not into the
tables. Canonical universal metrics (sleep_h, hrv_ms, rhr_bpm) still go in
daily_entries.

# Reasoning rhythm

The user invokes you through scheduled-agent recipes (morning check-in, evening
reflection, weekly review, race countdown, …) plus ad-hoc conversations.

At the start of a session, orient yourself by:
1. fs_read('CURRENT.md') and fs_read('PRINCIPLES.md') — the load-bearing context.
2. get_recent(days=7) for the structured data.
3. fs_read on the specific memory file the conversation touches (GOALS.md for
   race planning, NUTRITION.md for fueling, HEALTH_LOG.md for injuries).

Update memory files when you learn something durable (a new pattern, a resolved
injury, a goal change). Log structured rows when capturing today's data
(workouts, daily wellness, meals, new health events). Don't duplicate prose —
one canonical home per piece of information.

# When something feels off

If a scale value looks wrong, suspect the inverted-direction conventions before
suspecting bad data. If a write fails with a check-constraint error, you almost
certainly violated one of: wellness 1–5, severity 1–5, rpe 1–10, or health_event
kind in {injury, illness, symptom}.`;

/**
 * Build a fresh MCP server scoped to one authenticated user. Each request to
 * /api/mcp creates a new instance — tool callbacks close over `ctx.userId`,
 * so cross-tenant access is structurally impossible.
 */
export function buildMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    {
      name: "body-intelligence",
      version: "0.1.0",
    },
    {
      // Surfaced to the client (e.g. claude.ai) alongside the tool list so the
      // model has the conventions, data model, and rhythm in context from the
      // first message — without needing to call fs_list or guess.
      instructions: INSTRUCTIONS,
    },
  );

  // ---------- capture ----------

  server.registerTool(
    "log_workout",
    {
      title: "Log a workout",
      description:
        "Insert or upsert a workout. Manual writes (no source_id) always insert; connector writes (with source_id) upsert by (source, source_id) for idempotent re-runs.",
      inputSchema: logWorkoutInputSchema,
    },
    async (input) => jsonResult(await logWorkout(ctx.userId, input)),
  );

  server.registerTool(
    "log_daily",
    {
      title: "Log or update the daily entry",
      description:
        "Upsert the daily entry for (user, date). Partial fields allowed. All wellness scales follow 5 = best (fatigue/soreness/stress are inverted relative to their natural meaning so 5 is always the good direction).",
      inputSchema: logDailyInputSchema,
    },
    async (input) => jsonResult(await logDaily(ctx.userId, input)),
  );

  server.registerTool(
    "log_meal",
    {
      title: "Log a meal",
      description:
        "Insert or upsert a meal at a specific timestamp. Description is required; macros are optional and typically arrive via Phase-2 connector recipes (MFP, Cronometer, Apple Health).",
      inputSchema: logMealInputSchema,
    },
    async (input) => jsonResult(await logMeal(ctx.userId, input)),
  );

  server.registerTool(
    "log_health_event",
    {
      title: "Log a health event",
      description:
        "Append-only log for injuries, illnesses, and symptoms. severity is 1-5 with 5 = most severe — note this is OPPOSITE direction from the wellness scales.",
      inputSchema: logHealthEventInputSchema,
    },
    async (input) => jsonResult(await logHealthEvent(ctx.userId, input)),
  );

  server.registerTool(
    "fs_write",
    {
      title: "Write a memory document",
      description:
        "Upsert a markdown document at the given path. Full-document writes only — no patch semantics. Standard paths: PROFILE.md, PRINCIPLES.md, GOALS.md, CURRENT.md, HEALTH_LOG.md, NUTRITION.md, EQUIPMENT.md, MEMORY.md. Custom paths allowed (e.g. notes/2026-camp.md).",
      inputSchema: fsWriteInputSchema,
    },
    async (input) => jsonResult(await fsWrite(ctx.userId, input)),
  );

  // ---------- read ----------

  server.registerTool(
    "fs_read",
    {
      title: "Read a memory document",
      description:
        "Read one of the user's memory documents by path. Returns { path, content, updated_at } or null if the path doesn't exist.",
      inputSchema: fsReadInputSchema,
    },
    async (input) => jsonResult(await fsRead(ctx.userId, input)),
  );

  server.registerTool(
    "fs_list",
    {
      title: "List memory documents",
      description:
        "List the user's memory documents (path + updated_at). Optional prefix filter for namespaced paths.",
      inputSchema: fsListInputSchema,
    },
    async (input) => jsonResult(await fsList(ctx.userId, input)),
  );

  server.registerTool(
    "fs_search",
    {
      title: "Search memory documents",
      description:
        "Full-text search across the user's memory document content. Returns path + snippet for each match.",
      inputSchema: fsSearchInputSchema,
    },
    async (input) => jsonResult(await fsSearch(ctx.userId, input)),
  );

  server.registerTool(
    "get_recent",
    {
      title: "Get recent rows across entities",
      description:
        "Bundle workouts / daily entries / meals / health events from the last N days. Unresolved health events older than the window still come back. Use kinds= to subset.",
      inputSchema: getRecentInputSchema,
    },
    async (input) => jsonResult(await getRecent(ctx.userId, input)),
  );

  server.registerTool(
    "search_everything",
    {
      title: "Search across entities and documents",
      description:
        "Text search over all entity prose fields (workout notes, daily reflections, meal descriptions, health-event notes) plus document content. Sorted by updated_at desc.",
      inputSchema: searchEverythingInputSchema,
    },
    async (input) => jsonResult(await searchEverything(ctx.userId, input)),
  );

  return server;
}
