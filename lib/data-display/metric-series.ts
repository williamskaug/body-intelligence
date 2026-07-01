// DB → daily-series bridge. The impure layer that turns a metric key + date
// range into an aligned daily series, shared by BOTH the stats-engine MCP tools
// and the server-rendered Analyze charts so neither re-queries. All math is
// delegated to statistics.ts; this file only fetches and collapses.

import { adminClient } from "@/lib/supabase/admin";
import { type MetricKey, resolveMetric } from "@/lib/mcp/tools/metrics";
import { normalizeWorkoutType } from "@/lib/mcp/tools/shared";
import { datesInRange } from "./aggregate";
import { denseSeries, edwardsTrimp, toFinite } from "./statistics";

export type DailyAgg = "sum" | "mean" | "max";

// Per-workout metrics need a daily collapse before they can align with
// daily-table metrics (a day can hold several workouts). Accumulating
// quantities sum; a daily peak takes max; everything else averages.
const SUM_METRICS = new Set<string>([
  "workout_duration_min",
  "workout_distance_km",
  "workout_elevation_gain_m",
  "workout_vendor_training_load",
  "workout_strength_volume_kg",
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
]);
const MAX_METRICS = new Set<string>(["workout_max_hr"]);

export function defaultDailyAgg(metric: MetricKey): DailyAgg {
  if (SUM_METRICS.has(metric)) return "sum";
  if (MAX_METRICS.has(metric)) return "max";
  return "mean";
}

// Collapse one day's worth of finite values for a per-workout metric.
export function collapseDaily(values: ReadonlyArray<number>, agg: DailyAgg): number {
  if (agg === "sum") return values.reduce((a, b) => a + b, 0);
  if (agg === "max") return values.reduce((a, b) => Math.max(a, b), values[0]!);
  return values.reduce((a, b) => a + b, 0) / values.length; // mean
}

const ONE_ROW_PER_DAY = new Set(["daily_entries", "derived_daily", "capacity_metrics"]);

export type DailySeries = { map: Map<string, number>; agg: DailyAgg; n: number };

// Build a date→value map for one metric over [from, to]. Daily/derived/capacity
// tables are one row per day; workout-family tables are grouped + collapsed.
export async function dailySeriesForMetric(
  userId: string,
  metric: MetricKey,
  from: string,
  to: string,
  agg?: DailyAgg,
): Promise<DailySeries> {
  const { table, column } = resolveMetric(metric);
  const sb = adminClient();
  const { data, error } = await sb
    .from(table)
    .select(`date, ${column}`)
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to);
  if (error) throw new Error(`metric-series ${metric}: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const map = new Map<string, number>();

  if (ONE_ROW_PER_DAY.has(table)) {
    for (const row of rows) {
      const v = toFinite(row[column]);
      if (v != null) map.set(row.date as string, v);
    }
    return { map, agg: "mean", n: map.size };
  }

  const usedAgg = agg ?? defaultDailyAgg(metric);
  const byDate = new Map<string, number[]>();
  for (const row of rows) {
    const v = toFinite(row[column]);
    if (v == null) continue;
    const d = row.date as string;
    const arr = byDate.get(d);
    if (arr) arr.push(v);
    else byDate.set(d, [v]);
  }
  for (const [d, vals] of byDate) map.set(d, collapseDaily(vals, usedAgg));
  return { map, agg: usedAgg, n: map.size };
}

// Per-workout training impulse fallback: vendor load when present (>0), else
// duration × (rpe ?? 5). The vendor/rpe path matches the existing UI rule in
// components/data/trends.tsx.
export function impulseForWorkout(w: {
  duration_min: number | null;
  rpe: number | null;
  vendor_training_load: number | string | null;
}): number {
  const vendor = toFinite(w.vendor_training_load);
  if (vendor != null && vendor > 0) return vendor;
  const dur = toFinite(w.duration_min) ?? 0;
  const rpe = toFinite(w.rpe) ?? 5;
  return dur * rpe;
}

export type LoadSource = "zones" | "vendor" | "rpe";

// Per-workout load with precedence: Edwards zone-weighted TRIMP when HR-zone
// time exists (the most physiological, used for most Garmin runs) → vendor
// training load → duration×(rpe??5)/2. Returns the source so the load tool can
// report provenance. The three branches are normalized to a comparable
// TRIMP-equivalent scale: raw duration×rpe overshoots Edwards TRIMP (an hour of
// Z2 ≈ 120, but 60min×rpe6 = 360), so the fallback is halved to keep the EWMA
// commensurable when a window mixes sources.
export function workoutLoad(
  w: { duration_min: number | null; rpe: number | null; vendor_training_load: number | string | null },
  zoneSeconds: ReadonlyArray<number | null> | null | undefined,
): { load: number; source: LoadSource } {
  if (zoneSeconds && zoneSeconds.some((v) => v != null && Number(v) > 0)) {
    return { load: edwardsTrimp(zoneSeconds.map((v) => toFinite(v) ?? 0)), source: "zones" };
  }
  const vendor = toFinite(w.vendor_training_load);
  if (vendor != null && vendor > 0) return { load: vendor, source: "vendor" };
  const dur = toFinite(w.duration_min) ?? 0;
  const rpe = toFinite(w.rpe) ?? 5;
  return { load: dur * (rpe / 2), source: "rpe" };
}

// Types that carry logged duration but are not endurance training stimulus, so
// they must not inflate CTL/ATL/TSB. A deterministic taxonomy decision (like
// normalizeWorkoutType), not a verdict. Golf is the big offender (a 4h round
// otherwise dwarfs a real run).
export const NON_ENDURANCE_LOAD_TYPES: ReadonlySet<string> = new Set([
  "golf",
  "walk",
  "mobility",
  "yoga",
]);

type ZoneEmbed = {
  hr_z1_s: number | null;
  hr_z2_s: number | null;
  hr_z3_s: number | null;
  hr_z4_s: number | null;
  hr_z5_s: number | null;
};
type ImpulseRow = {
  date: string;
  type: string;
  duration_min: number | null;
  rpe: number | null;
  // PostgREST embeds a one-to-one relation as an object or a single-element
  // array depending on detection — handle both.
  workout_metrics:
    | { vendor_training_load: number | string | null }
    | Array<{ vendor_training_load: number | string | null }>
    | null;
  workout_zones: ZoneEmbed | ZoneEmbed[] | null;
};

export type ImpulseResult = {
  map: Map<string, number>;
  sources: Record<LoadSource, number>;
  excluded: number; // count of non-endurance workouts left out of load
};

// Sparse date→summed-impulse map over [from, to] plus a per-source workout count
// (provenance) and a count of non-endurance workouts excluded. Days with no
// counted workout are absent (the load tool 0-fills onto a dense axis before the
// EWMA). Non-endurance types (golf/walk/etc.) are excluded so they don't inflate
// fitness/fatigue/form.
export async function dailyImpulseSeries(
  userId: string,
  from: string,
  to: string,
): Promise<ImpulseResult> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("workouts")
    .select(
      "date, type, duration_min, rpe, workout_metrics(vendor_training_load), workout_zones(hr_z1_s,hr_z2_s,hr_z3_s,hr_z4_s,hr_z5_s)",
    )
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to);
  if (error) throw new Error(`dailyImpulseSeries: ${error.message}`);

  const map = new Map<string, number>();
  const sources: Record<LoadSource, number> = { zones: 0, vendor: 0, rpe: 0 };
  let excluded = 0;
  for (const row of (data ?? []) as unknown as ImpulseRow[]) {
    if (NON_ENDURANCE_LOAD_TYPES.has(normalizeWorkoutType(row.type ?? ""))) {
      excluded += 1;
      continue;
    }
    const wm = Array.isArray(row.workout_metrics)
      ? (row.workout_metrics[0] ?? null)
      : row.workout_metrics;
    const wz = Array.isArray(row.workout_zones)
      ? (row.workout_zones[0] ?? null)
      : row.workout_zones;
    const zoneSecs = wz
      ? [wz.hr_z1_s, wz.hr_z2_s, wz.hr_z3_s, wz.hr_z4_s, wz.hr_z5_s]
      : null;
    const { load, source } = workoutLoad(
      {
        duration_min: row.duration_min ?? null,
        rpe: row.rpe ?? null,
        vendor_training_load: wm?.vendor_training_load ?? null,
      },
      zoneSecs,
    );
    sources[source] += 1;
    map.set(row.date, (map.get(row.date) ?? 0) + load);
  }
  return { map, sources, excluded };
}

export type MultiSeriesResult = {
  dates: string[];
  series: Record<string, Array<number | null>>;
  counts: Record<string, number>;
  agg_used: Record<string, DailyAgg>;
};

// Aligned multi-metric daily series over a dense date axis (gaps = null).
// Backs both get_metric_series and the Analyze overlays/scatter. Metrics ≤ 8,
// so a query per metric is fine; each reuses dailySeriesForMetric.
export async function multiSeries(
  userId: string,
  metrics: ReadonlyArray<MetricKey>,
  from: string,
  to: string,
  aggOverrides: Partial<Record<string, DailyAgg>> = {},
): Promise<MultiSeriesResult> {
  const dates = datesInRange(from, to);
  const series: Record<string, Array<number | null>> = {};
  const counts: Record<string, number> = {};
  const aggUsed: Record<string, DailyAgg> = {};
  for (const m of metrics) {
    const { map, agg, n } = await dailySeriesForMetric(userId, m, from, to, aggOverrides[m]);
    series[m] = denseSeries(map, dates);
    counts[m] = n;
    aggUsed[m] = agg;
  }
  return { dates, series, counts, agg_used: aggUsed };
}
