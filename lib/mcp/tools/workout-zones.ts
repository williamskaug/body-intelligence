import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Optional per-workout time-in-zone (HR zones + cycling power zones), seconds
// per zone. Passed as a nested `zones` object on log_workout /
// bulk_log_workouts / update_workout — parallel to `metrics` — so a connector
// write stays one call per activity. Rows land in the workout_zones side
// table, upserted by workout_id (replace semantics).
const ZONE_SECONDS = z.number().int().min(0).max(86_400);

export const workoutZonesSchema = z.object({
  hr_z1_s: ZONE_SECONDS.optional().describe("Seconds in HR zone 1 (recovery)."),
  hr_z2_s: ZONE_SECONDS.optional().describe("Seconds in HR zone 2 (aerobic/endurance)."),
  hr_z3_s: ZONE_SECONDS.optional().describe("Seconds in HR zone 3 (tempo)."),
  hr_z4_s: ZONE_SECONDS.optional().describe("Seconds in HR zone 4 (threshold)."),
  hr_z5_s: ZONE_SECONDS.optional().describe("Seconds in HR zone 5 (VO2max/anaerobic)."),
  power_z1_s: ZONE_SECONDS.optional().describe("Seconds in cycling power zone 1."),
  power_z2_s: ZONE_SECONDS.optional(),
  power_z3_s: ZONE_SECONDS.optional(),
  power_z4_s: ZONE_SECONDS.optional(),
  power_z5_s: ZONE_SECONDS.optional(),
  power_z6_s: ZONE_SECONDS.optional(),
  power_z7_s: ZONE_SECONDS.optional().describe("Seconds in cycling power zone 7."),
});

export type WorkoutZonesInput = z.infer<typeof workoutZonesSchema>;

const ZONE_COLUMNS = [
  "hr_z1_s",
  "hr_z2_s",
  "hr_z3_s",
  "hr_z4_s",
  "hr_z5_s",
  "power_z1_s",
  "power_z2_s",
  "power_z3_s",
  "power_z4_s",
  "power_z5_s",
  "power_z6_s",
  "power_z7_s",
] as const;

/**
 * Replace the zones row for a workout. Omitted fields become NULL — a
 * connector re-run with fewer fields must not leave stale zone seconds behind.
 */
export async function upsertWorkoutZones(
  sb: SupabaseClient,
  userId: string,
  workoutId: string,
  date: string,
  zones: WorkoutZonesInput,
) {
  const payload: Record<string, unknown> = {
    workout_id: workoutId,
    user_id: userId,
    date,
    updated_at: new Date().toISOString(),
  };
  for (const key of ZONE_COLUMNS) {
    payload[key] = zones[key] ?? null;
  }

  const { data, error } = await sb
    .from("workout_zones")
    .upsert(payload, { onConflict: "workout_id" })
    .select()
    .single();
  if (error) throw new Error(`workout_zones upsert: ${error.message}`);
  return data;
}

export async function getWorkoutZones(
  sb: SupabaseClient,
  userId: string,
  workoutId: string,
) {
  const { data, error } = await sb
    .from("workout_zones")
    .select("*")
    .eq("user_id", userId)
    .eq("workout_id", workoutId)
    .maybeSingle();
  if (error) throw new Error(`workout_zones read: ${error.message}`);
  return data;
}
