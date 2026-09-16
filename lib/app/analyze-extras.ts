import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { AnalyzeTab } from "@/lib/app/analyze-tabs";
import { clipAtWord } from "@/lib/app/parse-week";
import { num } from "@/lib/app/format";
import type { AppSnapshot } from "@/lib/app/snapshot";
import { analyzeTabExtrasCacheKey, userDataTag } from "@/lib/app/snapshot-cache";
import { correlationReport, linregress } from "@/lib/data-display/statistics";
import { getCorrelationMatrix } from "@/lib/mcp/tools/get-correlation-matrix";
import { getDistribution } from "@/lib/mcp/tools/get-distribution";
import { getLoadBalance } from "@/lib/mcp/tools/get-load-balance";
import { getMetricSeries } from "@/lib/mcp/tools/get-metric-series";
import type { MetricKey } from "@/lib/mcp/tools/metrics";

const MATRIX_METRICS: MetricKey[] = [
  "hrv_ms",
  "rhr_bpm",
  "sleep_h",
  "workout_distance_km",
  "derived_acute_load_7d",
  "derived_chronic_load_28d",
  "stress_score",
  "body_battery_morning",
];

const DIST_METRICS: MetricKey[] = ["hrv_ms", "sleep_h", "derived_acute_load_7d"];

const CAPACITY_KEYS: MetricKey[] = [
  "capacity_vo2max_running",
  "capacity_race_pred_5k_s",
  "capacity_race_pred_10k_s",
  "capacity_race_pred_half_s",
  "capacity_race_pred_marathon_s",
];

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export const cachedLoadBalance = cache((userId: string, days: number) =>
  unstable_cache(
    () => getLoadBalance(userId, { days }),
    ["load-balance", userId, String(days)],
    { tags: [userDataTag(userId)], revalidate: 45 },
  )(),
);

export type AnalyzeExtras = {
  load: Awaited<ReturnType<typeof getLoadBalance>> | null;
  matrix: {
    metrics: string[];
    matrix: Array<Array<number | null>>;
    n: Array<Array<number>>;
  } | null;
  capacitySeries: { dates: string[]; series: Record<string, Array<number | null>> } | null;
  recoveryBase: { dates: string[]; series: Record<string, Array<number | null>> } | null;
  dists: Array<{
    metric: string;
    histogram: { edges: number[]; counts: number[] } | null;
    percentiles: { p5: number | null; p50: number | null; p95: number | null };
    latest: number | null;
  } | null>;
  sleepHrv: {
    points: Array<{ x: number; y: number; date: string }>;
    line: { x1: number; y1: number; x2: number; y2: number } | null;
    stats: { r: number | null; r2: number | null; slope: number | null; n: number };
  } | null;
  insightLead: string | null;
  insightPath: string | null;
};

function emptyExtras(): AnalyzeExtras {
  return {
    load: null,
    matrix: null,
    capacitySeries: null,
    recoveryBase: null,
    dists: [],
    sleepHrv: null,
    insightLead: null,
    insightPath: null,
  };
}

const loadCapacitySeries = cache((userId: string) =>
  unstable_cache(
    () => safe(getMetricSeries(userId, { metrics: CAPACITY_KEYS, window_days: 365 })),
    ["capacity-series", userId],
    { tags: [userDataTag(userId)], revalidate: 45 },
  )(),
);

const loadRecoverySeries = cache((userId: string, days: number) =>
  unstable_cache(
    () => safe(getMetricSeries(userId, { metrics: ["hrv_ms", "rhr_bpm"], window_days: days })),
    ["recovery-series", userId, String(days)],
    { tags: [userDataTag(userId)], revalidate: 45 },
  )(),
);

const loadStatsEngine = cache((userId: string, days: number) =>
  unstable_cache(
    async () => {
      const [matrix, ...dists] = await Promise.all([
        safe(getCorrelationMatrix(userId, { metrics: MATRIX_METRICS, window_days: days })),
        ...DIST_METRICS.map((metric) =>
          safe(getDistribution(userId, { metric, window_days: days, bins: 14 })),
        ),
      ]);
      return {
        matrix: matrix
          ? { metrics: matrix.metrics, matrix: matrix.matrix, n: matrix.n_matrix }
          : null,
        dists: dists.map((d, i) =>
          d
            ? {
                metric: DIST_METRICS[i]!,
                histogram: d.histogram,
                percentiles: {
                  p5: d.percentiles.p5,
                  p50: d.percentiles.p50,
                  p95: d.percentiles.p95,
                },
                latest: null as number | null,
              }
            : null,
        ),
      };
    },
    analyzeTabExtrasCacheKey(userId, days, false, "stats-engine"),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )(),
);

/** Fire tab extras without waiting on the route snapshot. */
export function prefetchAnalyzeExtras(userId: string, days: number, tab: AnalyzeTab): void {
  if (tab === "build" || tab === "stats") void cachedLoadBalance(userId, days);
  if (tab === "fitness") void loadCapacitySeries(userId);
  if (tab === "recovery") void loadRecoverySeries(userId, days);
  if (tab === "stats") void loadStatsEngine(userId, days);
}

/** Tab-scoped stats extras. Build does not wait on the correlation matrix. */
export async function loadAnalyzeExtrasForTab(
  userId: string,
  snapshot: AppSnapshot,
  tab: AnalyzeTab,
): Promise<AnalyzeExtras> {
  const days = Math.min(365, Math.max(snapshot.days, 90));
  const extras = emptyExtras();
  extras.insightPath = snapshot.latestInsightPath;
  if (snapshot.latestInsightPath) {
    extras.insightLead = insightLead(snapshot.contentByPath.get(snapshot.latestInsightPath) ?? null);
  }

  if (tab === "build" || tab === "stats") {
    extras.load = await safe(cachedLoadBalance(userId, days));
  }
  if (tab === "fitness") {
    const capacitySeries = await loadCapacitySeries(userId);
    extras.capacitySeries = capacitySeries
      ? { dates: capacitySeries.dates, series: capacitySeries.series }
      : null;
  }
  if (tab === "recovery") {
    const recoveryBase = await loadRecoverySeries(userId, days);
    extras.recoveryBase = recoveryBase
      ? { dates: recoveryBase.dates, series: recoveryBase.series }
      : null;
    extras.sleepHrv = sleepHrvScatter(snapshot);
  }
  if (tab === "stats") {
    const stats = await loadStatsEngine(userId, days);
    extras.matrix = stats.matrix;
    extras.dists = stats.dists.map((d) =>
      d ? { ...d, latest: latestDaily(snapshot, d.metric) } : null,
    );
  }
  return extras;
}

function latestDaily(snapshot: AppSnapshot, metric: string): number | null {
  for (const d of snapshot.dailyHistory) {
    if (metric === "hrv_ms" && d.hrv_ms != null) return d.hrv_ms;
    if (metric === "sleep_h") {
      const v = num(d.sleep_h);
      if (v != null) return v;
    }
    if (metric === "derived_acute_load_7d") {
      const row = snapshot.derived.find((x) => x.date === d.date);
      const v = num(row?.acute_load_7d ?? null);
      if (v != null) return v;
    }
  }
  return null;
}

function sleepHrvScatter(snapshot: AppSnapshot): AnalyzeExtras["sleepHrv"] {
  const a = new Map<string, number>();
  const b = new Map<string, number>();
  const points: Array<{ x: number; y: number; date: string }> = [];
  for (const d of snapshot.dailyHistory) {
    const sleep = num(d.sleep_h);
    if (sleep == null || d.hrv_ms == null) continue;
    a.set(d.date, sleep);
    b.set(d.date, d.hrv_ms);
    points.push({ x: sleep, y: d.hrv_ms, date: d.date });
  }
  if (points.length < 8) return null;
  const report = correlationReport(a, b, 0);
  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const reg = report.regression ?? linregress(xs, points.map((p) => p.y));
  return {
    points,
    line: reg
      ? {
          x1: minX,
          y1: reg.intercept + reg.slope * minX,
          x2: maxX,
          y2: reg.intercept + reg.slope * maxX,
        }
      : null,
    stats: {
      r: report.pearson_r,
      r2: reg?.r2 ?? null,
      slope: reg?.slope ?? null,
      n: report.n,
    },
  };
}

function insightLead(md: string | null): string | null {
  if (!md) return null;
  const line = md
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").replace(/^\*\*?/, "").trim())
    .find((l) => l.length > 24 && !l.startsWith("<!--"));
  if (!line) return null;
  return clipAtWord(line.replace(/\s+/g, " "), 180);
}
