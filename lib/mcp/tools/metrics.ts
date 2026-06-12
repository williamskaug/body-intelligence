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
  "skin_temp_deviation_c",
  "sleep_score",
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

// Per-workout sensor metrics live in the workout_metrics side table; the
// `date` column is denormalized there so range queries stay one-table.
export const WORKOUT_SENSOR_METRICS = [
  "workout_cadence_spm",
  "workout_gct_ms",
  "workout_gct_balance_pct_left",
  "workout_vertical_oscillation_mm",
  "workout_vertical_ratio_pct",
  "workout_stride_len_m",
  "workout_te_aerobic",
  "workout_te_anaerobic",
  "workout_vendor_training_load",
  "workout_stamina_min_pct",
  "workout_decoupling_pct",
  "workout_elevation_gain_m",
  "workout_avg_speed_kmh",
] as const;

// Agent-computed derived layer (derived_daily table).
export const DERIVED_METRICS = [
  "derived_hrv_z",
  "derived_rhr_z",
  "derived_sleep_z",
  "derived_sleep_debt_7d_min",
  "derived_acute_load_7d",
  "derived_chronic_load_28d",
] as const;

export const METRIC_KEYS = [
  ...DAILY_METRICS,
  ...WORKOUT_METRICS,
  ...WORKOUT_SENSOR_METRICS,
  ...DERIVED_METRICS,
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export function resolveMetric(metric: MetricKey): {
  table: "daily_entries" | "workouts" | "workout_metrics" | "derived_daily";
  column: string;
} {
  if ((DAILY_METRICS as readonly string[]).includes(metric)) {
    return { table: "daily_entries", column: metric };
  }
  if ((DERIVED_METRICS as readonly string[]).includes(metric)) {
    return { table: "derived_daily", column: metric.replace(/^derived_/, "") };
  }
  if ((WORKOUT_SENSOR_METRICS as readonly string[]).includes(metric)) {
    return { table: "workout_metrics", column: metric.replace(/^workout_/, "") };
  }
  return { table: "workouts", column: metric.replace(/^workout_/, "") };
}
