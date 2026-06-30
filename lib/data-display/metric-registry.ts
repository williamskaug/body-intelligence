// Display metadata for numeric metrics — label, unit, decimals, direction, and
// focus domain. The single source of truth for how the Analyze view and the
// per-metric drilldown label and color a metric. The DB table/column for a key
// comes from resolveMetric() in lib/mcp/tools/metrics.ts; this file is purely
// presentational.

export type MetricDomain = "recovery" | "endurance" | "injury" | "body";

export type MetricDef = {
  key: string;
  label: string;
  unit: string;
  decimals: number;
  // true → higher is better (HRV, sleep); false → lower is better (RHR, soreness
  // in raw terms); null → neutral (weight). Drives band coloring only.
  higherIsBetter: boolean | null;
  domain: MetricDomain;
};

const DEFS: MetricDef[] = [
  // ---- recovery ----
  { key: "hrv_ms", label: "HRV", unit: "ms", decimals: 0, higherIsBetter: true, domain: "recovery" },
  { key: "rhr_bpm", label: "Resting HR", unit: "bpm", decimals: 0, higherIsBetter: false, domain: "recovery" },
  { key: "sleep_h", label: "Sleep", unit: "h", decimals: 1, higherIsBetter: true, domain: "recovery" },
  { key: "sleep_score", label: "Sleep score", unit: "", decimals: 0, higherIsBetter: true, domain: "recovery" },
  { key: "sleep_deep_min", label: "Deep sleep", unit: "min", decimals: 0, higherIsBetter: true, domain: "recovery" },
  { key: "sleep_rem_min", label: "REM sleep", unit: "min", decimals: 0, higherIsBetter: true, domain: "recovery" },
  { key: "spo2_avg_pct", label: "SpO₂", unit: "%", decimals: 1, higherIsBetter: true, domain: "recovery" },
  { key: "respiration_avg_brpm", label: "Respiration", unit: "br/min", decimals: 1, higherIsBetter: false, domain: "recovery" },
  { key: "skin_temp_deviation_c", label: "Skin temp Δ", unit: "°C", decimals: 2, higherIsBetter: null, domain: "recovery" },
  { key: "stress_score", label: "Stress", unit: "", decimals: 0, higherIsBetter: false, domain: "recovery" },
  { key: "body_battery_morning", label: "Body Battery (wake)", unit: "", decimals: 0, higherIsBetter: true, domain: "recovery" },
  { key: "training_readiness_score", label: "Training readiness", unit: "", decimals: 0, higherIsBetter: true, domain: "recovery" },
  // ---- wellness scales (5 = best) ----
  { key: "fatigue", label: "Fatigue (5=best)", unit: "/5", decimals: 0, higherIsBetter: true, domain: "recovery" },
  { key: "soreness", label: "Soreness (5=best)", unit: "/5", decimals: 0, higherIsBetter: true, domain: "injury" },
  { key: "mood", label: "Mood", unit: "/5", decimals: 0, higherIsBetter: true, domain: "recovery" },
  { key: "stress", label: "Stress (5=best)", unit: "/5", decimals: 0, higherIsBetter: true, domain: "recovery" },
  { key: "motivation", label: "Motivation", unit: "/5", decimals: 0, higherIsBetter: true, domain: "recovery" },
  { key: "sleep_quality", label: "Sleep quality", unit: "/5", decimals: 0, higherIsBetter: true, domain: "recovery" },
  // ---- movement / body ----
  { key: "steps", label: "Steps", unit: "", decimals: 0, higherIsBetter: true, domain: "body" },
  { key: "active_calories", label: "Active kcal", unit: "", decimals: 0, higherIsBetter: true, domain: "body" },
  { key: "floors_climbed", label: "Floors", unit: "", decimals: 0, higherIsBetter: true, domain: "body" },
  { key: "weight_kg", label: "Weight", unit: "kg", decimals: 1, higherIsBetter: null, domain: "body" },
  { key: "body_fat_pct", label: "Body fat", unit: "%", decimals: 1, higherIsBetter: null, domain: "body" },
  { key: "muscle_mass_kg", label: "Muscle mass", unit: "kg", decimals: 1, higherIsBetter: null, domain: "body" },
  { key: "body_water_pct", label: "Body water", unit: "%", decimals: 1, higherIsBetter: null, domain: "body" },
  { key: "bp_systolic_mmhg", label: "BP systolic", unit: "mmHg", decimals: 0, higherIsBetter: false, domain: "body" },
  { key: "bp_diastolic_mmhg", label: "BP diastolic", unit: "mmHg", decimals: 0, higherIsBetter: false, domain: "body" },
  { key: "hydration_ml", label: "Hydration", unit: "ml", decimals: 0, higherIsBetter: true, domain: "body" },
  // ---- derived ----
  { key: "derived_hrv_z", label: "HRV z-score", unit: "z", decimals: 2, higherIsBetter: true, domain: "recovery" },
  { key: "derived_rhr_z", label: "RHR z-score", unit: "z", decimals: 2, higherIsBetter: false, domain: "recovery" },
  { key: "derived_sleep_z", label: "Sleep z-score", unit: "z", decimals: 2, higherIsBetter: true, domain: "recovery" },
  { key: "derived_sleep_debt_7d_min", label: "Sleep debt (7d)", unit: "min", decimals: 0, higherIsBetter: false, domain: "recovery" },
  { key: "derived_acute_load_7d", label: "Acute load (7d)", unit: "", decimals: 0, higherIsBetter: null, domain: "endurance" },
  { key: "derived_chronic_load_28d", label: "Chronic load (28d)", unit: "", decimals: 0, higherIsBetter: null, domain: "endurance" },
  // ---- workout sensor (injury / form / endurance) ----
  { key: "workout_cadence_spm", label: "Cadence", unit: "spm", decimals: 0, higherIsBetter: true, domain: "injury" },
  { key: "workout_gct_balance_pct_left", label: "GCT balance (L)", unit: "%", decimals: 1, higherIsBetter: null, domain: "injury" },
  { key: "workout_vertical_oscillation_mm", label: "Vertical oscillation", unit: "mm", decimals: 1, higherIsBetter: false, domain: "injury" },
  { key: "workout_vertical_ratio_pct", label: "Vertical ratio", unit: "%", decimals: 1, higherIsBetter: false, domain: "injury" },
  { key: "workout_decoupling_pct", label: "Decoupling", unit: "%", decimals: 1, higherIsBetter: false, domain: "endurance" },
  { key: "workout_te_aerobic", label: "Aerobic TE", unit: "", decimals: 1, higherIsBetter: null, domain: "endurance" },
  { key: "workout_vendor_training_load", label: "Session load", unit: "", decimals: 0, higherIsBetter: null, domain: "endurance" },
  { key: "workout_avg_speed_kmh", label: "Avg speed", unit: "km/h", decimals: 1, higherIsBetter: true, domain: "endurance" },
  { key: "workout_avg_hr", label: "Avg HR", unit: "bpm", decimals: 0, higherIsBetter: null, domain: "endurance" },
  // ---- capacity ----
  { key: "capacity_vo2max_running", label: "VO₂max (run)", unit: "", decimals: 1, higherIsBetter: true, domain: "endurance" },
  { key: "capacity_vo2max_cycling", label: "VO₂max (bike)", unit: "", decimals: 1, higherIsBetter: true, domain: "endurance" },
  { key: "capacity_cycling_ftp_w", label: "FTP", unit: "W", decimals: 0, higherIsBetter: true, domain: "endurance" },
  { key: "capacity_lactate_threshold_hr_bpm", label: "Lactate threshold HR", unit: "bpm", decimals: 0, higherIsBetter: true, domain: "endurance" },
  { key: "capacity_endurance_score", label: "Endurance score", unit: "", decimals: 0, higherIsBetter: true, domain: "endurance" },
  { key: "capacity_fitness_age_years", label: "Fitness age", unit: "yr", decimals: 1, higherIsBetter: false, domain: "endurance" },
];

export const METRICS: Record<string, MetricDef> = Object.fromEntries(
  DEFS.map((d) => [d.key, d]),
);

export function metricDef(key: string): MetricDef | null {
  return METRICS[key] ?? null;
}

// Humanize a metric key when it isn't in the registry (e.g. for an axis label).
export function metricLabel(key: string): string {
  const def = METRICS[key];
  if (def) return def.label;
  return key
    .replace(/^derived_/, "")
    .replace(/^capacity_/, "")
    .replace(/^workout_/, "")
    .replace(/_/g, " ");
}

export function formatMetricValue(key: string, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const def = METRICS[key];
  const decimals = def?.decimals ?? 1;
  const unit = def?.unit ?? "";
  return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}
