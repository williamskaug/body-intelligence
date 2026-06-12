import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Optional per-workout sensor metrics (running dynamics, training effect,
// stamina, durability). Passed as a nested `metrics` object on log_workout /
// bulk_log_workouts / update_workout — there is no standalone metrics tool,
// so a connector write stays one call per activity. Rows land in the
// workout_metrics side table, upserted by workout_id (replace semantics).
export const workoutMetricsSchema = z.object({
  cadence_spm: z.number().min(0).max(300).optional()
    .describe("Average cadence, steps (or rpm) per minute."),
  gct_ms: z.number().int().min(50).max(1000).optional()
    .describe("Average ground contact time in ms."),
  gct_balance_pct_left: z.number().min(30).max(70).optional()
    .describe("Left-foot share of ground contact, e.g. 48.32 = 48.32% L / 51.68% R."),
  vertical_oscillation_mm: z.number().min(0).max(300).optional(),
  vertical_ratio_pct: z.number().min(0).max(99).optional(),
  stride_len_m: z.number().min(0).max(5).optional(),
  te_aerobic: z.number().min(0).max(5).optional()
    .describe("Vendor aerobic training effect 0.0–5.0. The label (e.g. IMPROVING_AEROBIC_BASE) stays in daily/YYYY-MM-DD.md."),
  te_anaerobic: z.number().min(0).max(5).optional(),
  vendor_training_load: z.number().min(0).max(10_000).optional()
    .describe("Vendor activity training load (e.g. Garmin activityTrainingLoad)."),
  stamina_start_pct: z.number().int().min(0).max(100).optional(),
  stamina_end_pct: z.number().int().min(0).max(100).optional(),
  stamina_min_pct: z.number().int().min(0).max(100).optional(),
  decoupling_pct: z.number().min(-100).max(100).optional()
    .describe("HR-speed/power decoupling % over the session; negative = second half more efficient."),
  elevation_gain_m: z.number().int().min(0).max(20_000).optional(),
  elevation_loss_m: z.number().int().min(0).max(20_000).optional(),
  avg_speed_kmh: z.number().min(0).max(150).optional(),
  max_speed_kmh: z.number().min(0).max(150).optional(),
});

export type WorkoutMetricsInput = z.infer<typeof workoutMetricsSchema>;

const METRIC_COLUMNS = [
  "cadence_spm",
  "gct_ms",
  "gct_balance_pct_left",
  "vertical_oscillation_mm",
  "vertical_ratio_pct",
  "stride_len_m",
  "te_aerobic",
  "te_anaerobic",
  "vendor_training_load",
  "stamina_start_pct",
  "stamina_end_pct",
  "stamina_min_pct",
  "decoupling_pct",
  "elevation_gain_m",
  "elevation_loss_m",
  "avg_speed_kmh",
  "max_speed_kmh",
] as const;

/**
 * Replace the metrics row for a workout. Omitted fields become NULL — a
 * connector re-run with fewer fields must not leave stale values behind.
 */
export async function upsertWorkoutMetrics(
  sb: SupabaseClient,
  userId: string,
  workoutId: string,
  date: string,
  metrics: WorkoutMetricsInput,
) {
  const payload: Record<string, unknown> = {
    workout_id: workoutId,
    user_id: userId,
    date,
    updated_at: new Date().toISOString(),
  };
  for (const key of METRIC_COLUMNS) {
    payload[key] = metrics[key] ?? null;
  }

  const { data, error } = await sb
    .from("workout_metrics")
    .upsert(payload, { onConflict: "workout_id" })
    .select()
    .single();
  if (error) throw new Error(`workout_metrics upsert: ${error.message}`);
  return data;
}

export async function getWorkoutMetrics(
  sb: SupabaseClient,
  userId: string,
  workoutId: string,
) {
  const { data, error } = await sb
    .from("workout_metrics")
    .select("*")
    .eq("user_id", userId)
    .eq("workout_id", workoutId)
    .maybeSingle();
  if (error) throw new Error(`workout_metrics read: ${error.message}`);
  return data;
}
