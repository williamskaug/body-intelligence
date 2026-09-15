import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { AnalyzeExtras } from "@/components/analyze/analyze-view";
import { num } from "@/lib/app/format";
import type { AppSnapshot } from "@/lib/app/snapshot";
import { analyzeExtrasCacheKey, userDataTag } from "@/lib/app/snapshot-cache";
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

type HeavyExtras = Pick<
  AnalyzeExtras,
  "load" | "matrix" | "capacitySeries" | "recoveryBase" | "dists"
>;

const loadHeavyExtras = cache((userId: string, days: number, focusRun: boolean) =>
  unstable_cache(
    async (): Promise<Omit<HeavyExtras, "dists"> & { distPayload: HeavyExtras["dists"] }> => {
      const [load, matrix, capacitySeries, recoveryBase, ...dists] = await Promise.all([
        safe(cachedLoadBalance(userId, days)),
        safe(getCorrelationMatrix(userId, { metrics: MATRIX_METRICS, window_days: days })),
        safe(getMetricSeries(userId, { metrics: CAPACITY_KEYS, window_days: 365 })),
        safe(getMetricSeries(userId, { metrics: ["hrv_ms", "rhr_bpm"], window_days: days })),
        ...DIST_METRICS.map((metric) =>
          safe(getDistribution(userId, { metric, window_days: days, bins: 14 })),
        ),
      ]);
      return {
        load,
        matrix: matrix
          ? { metrics: matrix.metrics, matrix: matrix.matrix, n: matrix.n_matrix }
          : null,
        capacitySeries: capacitySeries
          ? { dates: capacitySeries.dates, series: capacitySeries.series }
          : null,
        recoveryBase: recoveryBase
          ? { dates: recoveryBase.dates, series: recoveryBase.series }
          : null,
        distPayload: dists.map((d, i) =>
          d
            ? {
                metric: DIST_METRICS[i]!,
                histogram: d.histogram,
                percentiles: {
                  p5: d.percentiles.p5,
                  p50: d.percentiles.p50,
                  p95: d.percentiles.p95,
                },
                latest: null,
              }
            : null,
        ),
      };
    },
    analyzeExtrasCacheKey(userId, days, focusRun),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )(),
);

export async function loadAnalyzeExtras(
  userId: string,
  snapshot: AppSnapshot,
): Promise<AnalyzeExtras> {
  const days = Math.min(365, Math.max(snapshot.days, 90));
  const heavy = await loadHeavyExtras(userId, days, snapshot.focusRun);
  const insight = snapshot.latestInsightPath
    ? (snapshot.contentByPath.get(snapshot.latestInsightPath) ?? null)
    : null;

  return {
    load: heavy.load,
    matrix: heavy.matrix,
    capacitySeries: heavy.capacitySeries,
    recoveryBase: heavy.recoveryBase,
    dists: heavy.distPayload.map((d) =>
      d ? { ...d, latest: latestDaily(snapshot, d.metric) } : null,
    ),
    sleepHrv: sleepHrvScatter(snapshot),
    insightLead: insightLead(insight),
    insightPath: snapshot.latestInsightPath,
  };
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
  return line ?? null;
}
