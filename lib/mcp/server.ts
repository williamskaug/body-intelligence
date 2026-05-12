import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResult } from "./tools/shared";
import { fsRead, fsReadInputSchema } from "./tools/fs-read";
import { fsWrite, fsWriteInputSchema } from "./tools/fs-write";
import { fsDelete, fsDeleteInputSchema } from "./tools/fs-delete";
import { fsList, fsListInputSchema } from "./tools/fs-list";
import { fsSearch, fsSearchInputSchema } from "./tools/fs-search";
import { logWorkout, logWorkoutInputSchema } from "./tools/log-workout";
import { updateWorkout, updateWorkoutInputSchema } from "./tools/update-workout";
import { deleteWorkout, deleteWorkoutInputSchema } from "./tools/delete-workout";
import { logDaily, logDailyInputSchema } from "./tools/log-daily";
import {
  deleteDailyEntry,
  deleteDailyEntryInputSchema,
} from "./tools/delete-daily-entry";
import { logMeal, logMealInputSchema } from "./tools/log-meal";
import { updateMeal, updateMealInputSchema } from "./tools/update-meal";
import { deleteMeal, deleteMealInputSchema } from "./tools/delete-meal";
import { logHealthEvent, logHealthEventInputSchema } from "./tools/log-health-event";
import {
  updateHealthEvent,
  updateHealthEventInputSchema,
} from "./tools/update-health-event";
import {
  deleteHealthEvent,
  deleteHealthEventInputSchema,
} from "./tools/delete-health-event";
import { getRecent, getRecentInputSchema } from "./tools/get-recent";
import { searchEverything, searchEverythingInputSchema } from "./tools/search-everything";
import {
  getSetupGuide,
  getSetupGuideInputSchema,
  SETUP_GUIDE,
} from "./tools/get-setup-guide";

export type McpContext = {
  userId: string;
  clientId: string;
};

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
      // Spec-mandated field. Some MCP clients surface it to the model; others
      // (currently claude.ai) drop it. Keep it populated so well-behaved clients
      // benefit, but rely on get_setup_guide as the authoritative channel.
      instructions: SETUP_GUIDE,
    },
  );

  // Register get_setup_guide FIRST so it appears at the top of the tool list —
  // the tool name + description is the channel claude.ai actually reads.
  server.registerTool(
    "get_setup_guide",
    {
      title: "Get the BI setup guide",
      description:
        "READ THIS FIRST when connecting to Body Intelligence. Returns the usage guide: data model, scale conventions (5=best for wellness, 5=worst for severity), the eight standard memory file paths and their purposes, idempotency rules, and the intended reasoning rhythm. Call this once at the start of a session before reasoning about the user's data.",
      inputSchema: getSetupGuideInputSchema,
    },
    async () => jsonResult(getSetupGuide()),
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
    "update_workout",
    {
      title: "Update a workout by id",
      description:
        "Patch fields on an existing workout. Only the fields you pass are touched; the rest are preserved. Use this for after-the-fact corrections. Find the id via get_recent or search_everything.",
      inputSchema: updateWorkoutInputSchema,
    },
    async (input) => jsonResult(await updateWorkout(ctx.userId, input)),
  );

  server.registerTool(
    "delete_workout",
    {
      title: "Delete a workout by id",
      description:
        "Hard delete a workout row. Irreversible. Use sparingly — prefer update_workout when correcting bad data so historical trends stay intact.",
      inputSchema: deleteWorkoutInputSchema,
    },
    async (input) => jsonResult(await deleteWorkout(ctx.userId, input)),
  );

  server.registerTool(
    "log_daily",
    {
      title: "Log or update the daily entry",
      description:
        "Upsert the daily entry for (user, date). Partial fields allowed — this is also the update path: re-call with any subset of fields and only those change. All wellness scales follow 5 = best (fatigue/soreness/stress are inverted relative to their natural meaning so 5 is always the good direction).",
      inputSchema: logDailyInputSchema,
    },
    async (input) => jsonResult(await logDaily(ctx.userId, input)),
  );

  server.registerTool(
    "delete_daily_entry",
    {
      title: "Delete the daily entry for a date",
      description:
        "Hard delete the daily_entries row for (user, date). Irreversible. Use sparingly — prefer log_daily with corrected values when fixing bad data.",
      inputSchema: deleteDailyEntryInputSchema,
    },
    async (input) => jsonResult(await deleteDailyEntry(ctx.userId, input)),
  );

  server.registerTool(
    "log_meal",
    {
      title: "Log a meal",
      description:
        "Insert or upsert a meal at a specific timestamp. calories, protein_g, carbs_g, and fat_g are REQUIRED — every meal row must carry full energy + macro data. If the caller does not have authoritative values (food label, connector payload, weighed portion), it MUST estimate them from the description before writing. Do not skip the write to avoid estimating; an estimate is the expected behaviour. Fiber_g is optional. Connector writes (with source_id) upsert by (source, source_id); manual writes always insert.",
      inputSchema: logMealInputSchema,
    },
    async (input) => jsonResult(await logMeal(ctx.userId, input)),
  );

  server.registerTool(
    "update_meal",
    {
      title: "Update a meal by id",
      description:
        "Patch fields on an existing meal. Pass any subset of fields; only those change. Unlike log_meal, macro fields are NOT required here — this is for fixing existing rows. To clear a stale value, pass null explicitly.",
      inputSchema: updateMealInputSchema,
    },
    async (input) => jsonResult(await updateMeal(ctx.userId, input)),
  );

  server.registerTool(
    "delete_meal",
    {
      title: "Delete a meal by id",
      description: "Hard delete a meal row. Irreversible.",
      inputSchema: deleteMealInputSchema,
    },
    async (input) => jsonResult(await deleteMeal(ctx.userId, input)),
  );

  server.registerTool(
    "log_health_event",
    {
      title: "Log a health event",
      description:
        "Insert a new injury, illness, or symptom. severity is 1-5 with 5 = most severe — note this is OPPOSITE direction from the wellness scales. To mark an event as resolved later, call update_health_event with resolved_date.",
      inputSchema: logHealthEventInputSchema,
    },
    async (input) => jsonResult(await logHealthEvent(ctx.userId, input)),
  );

  server.registerTool(
    "update_health_event",
    {
      title: "Update a health event by id",
      description:
        "Patch fields on an existing health event. This is also how you RESOLVE an event — pass resolved_date with the date the issue cleared. Pass resolved_date: null to re-open a previously-resolved event.",
      inputSchema: updateHealthEventInputSchema,
    },
    async (input) => jsonResult(await updateHealthEvent(ctx.userId, input)),
  );

  server.registerTool(
    "delete_health_event",
    {
      title: "Delete a health event by id",
      description:
        "Hard delete a health event row. Irreversible. Prefer update_health_event with resolved_date when an event is simply over — deletion loses the history entirely.",
      inputSchema: deleteHealthEventInputSchema,
    },
    async (input) => jsonResult(await deleteHealthEvent(ctx.userId, input)),
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

  server.registerTool(
    "fs_delete",
    {
      title: "Delete a memory document",
      description:
        "Hard delete a document at the given path. Irreversible. The eight standard memory files (MEMORY.md, PROFILE.md, etc.) are only seeded once on signup — deleting one will not bring it back. Prefer fs_write with replacement content when the file should keep existing.",
      inputSchema: fsDeleteInputSchema,
    },
    async (input) => jsonResult(await fsDelete(ctx.userId, input)),
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
