import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const isoTimestamp = z
  .string()
  .min(10)
  .describe("ISO 8601 timestamp; offset preferred (e.g. 2026-05-08T08:30:00+02:00)");

export const wellnessScale = z.number().int().min(1).max(5);

// Path validation for the virtual filesystem. Paths are slash-separated
// segments ending in .md. Folders are implicit — writing to "notes/x.md"
// creates the file directly, no folder record needed.
export const documentPath = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((p) => !p.startsWith("/"), "no leading slash")
  .refine((p) => !p.endsWith("/"), "no trailing slash")
  .refine((p) => !p.includes("//"), "no empty path segments")
  .refine((p) => !p.includes(".."), "no parent traversal")
  .refine(
    (p) => p.split("/").every((seg) => seg.length > 0 && !seg.startsWith(".") && seg !== "."),
    "no hidden or empty segments",
  )
  .refine((p) => /^[A-Za-z0-9_/.\-]+\.md$/.test(p), "must end in .md and use [A-Za-z0-9_/.-]");

// Canonical workout-type vocabulary. Connector and manual writes funnel
// through normalizeWorkoutType() so "running", "Road Cycling", and
// "road_biking" all land as one canonical type instead of fragmenting the
// donut chart, calendar labels, and per-type stats. Unknown types pass
// through lowercased + snake_cased — never rejected (a connector inventing
// a new activity type must not fail a 09:00 scheduled sync).
// The display layer (lib/data-display/workout-types.ts) keys off the same
// canonical set. Mirror changes into the backfill migration if you extend
// the alias map.
export const CANONICAL_WORKOUT_TYPES = [
  "run",
  "trail_run",
  "ride",
  "gravel_ride",
  "mtb",
  "golf",
  "strength",
  "walk",
  "hike",
  "swim",
  "row",
  "yoga",
  "mobility",
  "xc_ski",
  "orienteering",
  "padel",
  "other",
] as const;

export const WORKOUT_TYPE_ALIASES: Record<string, string> = {
  running: "run",
  jog: "run",
  jogging: "run",
  street_running: "run",
  track_running: "run",
  treadmill_running: "run",
  rwd_run: "run",
  trail: "trail_run",
  trail_running: "trail_run",
  cycling: "ride",
  bike: "ride",
  biking: "ride",
  road_biking: "ride",
  road_cycling: "ride",
  virtual_ride: "ride",
  indoor_cycling: "ride",
  gravel: "gravel_ride",
  gravel_cycling: "gravel_ride",
  gravel_biking: "gravel_ride",
  mountain_biking: "mtb",
  mtb_ride: "mtb",
  lift: "strength",
  lifting: "strength",
  weight_training: "strength",
  weighttraining: "strength",
  strength_training: "strength",
  indoor_strength: "strength",
  gym: "strength",
  walking: "walk",
  casual_walking: "walk",
  speed_walking: "walk",
  hiking: "hike",
  swimming: "swim",
  lap_swimming: "swim",
  open_water_swimming: "swim",
  pool_swim: "swim",
  rowing: "row",
  indoor_rowing: "row",
  nordic_ski: "xc_ski",
  nordic_skiing: "xc_ski",
  cross_country_skiing: "xc_ski",
  classic_skiing: "xc_ski",
  skate_skiing: "xc_ski",
  xc_skiing: "xc_ski",
  padel_tennis: "padel",
};

export function normalizeWorkoutType(raw: string): string {
  const snake = raw.trim().toLowerCase().replace(/[\s\-]+/g, "_");
  return WORKOUT_TYPE_ALIASES[snake] ?? snake;
}

// Escape SQL LIKE wildcards so a user-supplied prefix can't match more than
// intended (e.g. "notes_" should match literal underscore, not any single char).
export function escapeLikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function jsonResult(payload: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as { [key: string]: unknown },
  };
}

export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}
