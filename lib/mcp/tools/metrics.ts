// Metric → (table, column) mapping for get_baseline and get_stats.
// Daily-entry metrics use the column name verbatim; workout-side metrics
// are prefixed with "workout_" to keep the enum unambiguous.

export const DAILY_METRICS = [
  "sleep_h",
  "sleep_deep_min",
  "sleep_light_min",
  "sleep_rem_min",
  "sleep_awake_min",
  "hrv_ms",
  "rhr_bpm",
  "spo2_avg_pct",
  "respiration_avg_brpm",
  "weight_kg",
  "body_fat_pct",
  "steps",
  "active_calories",
  "floors_climbed",
  "intensity_min_moderate",
  "intensity_min_vigorous",
  "fatigue",
  "soreness",
  "mood",
  "stress",
  "motivation",
  "sleep_quality",
] as const;

export const WORKOUT_METRICS = [
  "workout_duration_min",
  "workout_distance_km",
  "workout_avg_hr",
  "workout_max_hr",
  "workout_rpe",
] as const;

export const METRIC_KEYS = [...DAILY_METRICS, ...WORKOUT_METRICS] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export function resolveMetric(metric: MetricKey): {
  table: "daily_entries" | "workouts";
  column: string;
} {
  if ((DAILY_METRICS as readonly string[]).includes(metric)) {
    return { table: "daily_entries", column: metric };
  }
  return { table: "workouts", column: metric.replace(/^workout_/, "") };
}
