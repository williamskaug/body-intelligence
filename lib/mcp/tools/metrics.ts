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
  // Recovery / readiness vendor scalars + body composition + health vitals.
  // (training_status is text, not a numeric metric, so it is intentionally
  // excluded — get_stats/get_baseline compute over numbers.)
  "stress_score",
  "body_battery_morning",
  "body_battery_high",
  "body_battery_low",
  "body_battery_charged",
  "body_battery_drained",
  "training_readiness_score",
  "muscle_mass_kg",
  "bone_mass_kg",
  "body_water_pct",
  "bp_systolic_mmhg",
  "bp_diastolic_mmhg",
  "hydration_ml",
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
  "workout_weather_temp_c",
  "workout_weather_humidity_pct",
  "workout_strength_volume_kg",
] as const;

// Per-workout time-in-zone (workout_zones side table). Seconds in each HR /
// cycling-power zone. Prefixed "workout_" like the sensor metrics.
export const WORKOUT_ZONE_METRICS = [
  "workout_hr_z1_s",
  "workout_hr_z2_s",
  "workout_hr_z3_s",
  "workout_hr_z4_s",
  "workout_hr_z5_s",
  "workout_power_z1_s",
  "workout_power_z2_s",
  "workout_power_z3_s",
  "workout_power_z4_s",
  "workout_power_z5_s",
  "workout_power_z6_s",
  "workout_power_z7_s",
] as const;

// Slow-moving fitness-capacity snapshots (capacity_metrics table). Prefixed
// "capacity_" so the enum stays unambiguous; resolveMetric strips the prefix.
export const CAPACITY_METRICS = [
  "capacity_vo2max_running",
  "capacity_vo2max_cycling",
  "capacity_lactate_threshold_hr_bpm",
  "capacity_lactate_threshold_pace_s_per_km",
  "capacity_lactate_threshold_power_w",
  "capacity_cycling_ftp_w",
  "capacity_endurance_score",
  "capacity_hill_score",
  "capacity_fitness_age_years",
  "capacity_running_tolerance_km",
  "capacity_race_pred_5k_s",
  "capacity_race_pred_10k_s",
  "capacity_race_pred_half_s",
  "capacity_race_pred_marathon_s",
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
  ...WORKOUT_ZONE_METRICS,
  ...CAPACITY_METRICS,
  ...DERIVED_METRICS,
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export function resolveMetric(metric: MetricKey): {
  table:
    | "daily_entries"
    | "workouts"
    | "workout_metrics"
    | "workout_zones"
    | "capacity_metrics"
    | "derived_daily";
  column: string;
} {
  if ((DAILY_METRICS as readonly string[]).includes(metric)) {
    return { table: "daily_entries", column: metric };
  }
  if ((DERIVED_METRICS as readonly string[]).includes(metric)) {
    return { table: "derived_daily", column: metric.replace(/^derived_/, "") };
  }
  if ((CAPACITY_METRICS as readonly string[]).includes(metric)) {
    return { table: "capacity_metrics", column: metric.replace(/^capacity_/, "") };
  }
  // Zone metrics must be checked before the sensor / workouts fallthrough —
  // they share the "workout_" prefix but route to a different table.
  if ((WORKOUT_ZONE_METRICS as readonly string[]).includes(metric)) {
    return { table: "workout_zones", column: metric.replace(/^workout_/, "") };
  }
  if ((WORKOUT_SENSOR_METRICS as readonly string[]).includes(metric)) {
    return { table: "workout_metrics", column: metric.replace(/^workout_/, "") };
  }
  return { table: "workouts", column: metric.replace(/^workout_/, "") };
}
