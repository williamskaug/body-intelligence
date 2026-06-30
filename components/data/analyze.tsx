import { Trends } from "./trends";
import { InsightsFeed, type InsightDoc } from "./insights-feed";
import { CorrelationHeatmap } from "./charts/correlation-heatmap";
import { HistogramChart } from "./charts/histogram-chart";
import { MultiSeriesLine } from "./charts/multi-series-line";
import { PerformanceManagementChart } from "./charts/performance-management-chart";
import { ScatterRegression } from "./charts/scatter-regression";
import { detectAnomalies, topAnomalies } from "@/lib/data-display/anomalies";
import { metricLabel } from "@/lib/data-display/metric-registry";
import { dailySeriesForMetric } from "@/lib/data-display/metric-series";
import { alignByDate, linregress, pearson } from "@/lib/data-display/statistics";
import type { MetricKey } from "@/lib/mcp/tools/metrics";
import { getCorrelationMatrix } from "@/lib/mcp/tools/get-correlation-matrix";
import { getDistribution } from "@/lib/mcp/tools/get-distribution";
import { getLoadBalance } from "@/lib/mcp/tools/get-load-balance";
import { getMetricSeries } from "@/lib/mcp/tools/get-metric-series";

type TrendsProps = Parameters<typeof Trends>[0];

export type AnalyzeProps = TrendsProps & {
  userId: string;
  days: number;
  insights: InsightDoc[];
};

const HEATMAP_METRICS: MetricKey[] = [
  "hrv_ms",
  "rhr_bpm",
  "sleep_h",
  "derived_sleep_debt_7d_min",
  "derived_acute_load_7d",
  "soreness",
  "weight_kg",
  "body_fat_pct",
];

const DIST_METRICS: MetricKey[] = ["hrv_ms", "rhr_bpm", "sleep_h", "weight_kg"];

const PAIRS: Array<{ a: MetricKey; b: MetricKey; lag: number; title: string }> = [
  { a: "sleep_h", b: "hrv_ms", lag: 1, title: "Sleep → next-day HRV" },
  { a: "derived_acute_load_7d", b: "hrv_ms", lag: 1, title: "Acute load → next-day HRV" },
  { a: "workout_cadence_spm", b: "workout_vertical_oscillation_mm", lag: 0, title: "Cadence → vertical oscillation" },
  { a: "rhr_bpm", b: "sleep_quality", lag: 0, title: "Resting HR → sleep quality" },
];

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    // Tolerate a not-yet-applied migration or an empty table — the band just
    // renders its low-data state instead of crashing the page.
    return null;
  }
}

async function buildScatter(
  userId: string,
  a: MetricKey,
  b: MetricKey,
  from: string,
  to: string,
  lag: number,
) {
  const [sa, sb] = await Promise.all([
    dailySeriesForMetric(userId, a, from, to),
    dailySeriesForMetric(userId, b, from, to),
  ]);
  const { xs, ys, dates } = alignByDate(sa.map, sb.map, lag);
  const reg = linregress(xs, ys);
  const r = pearson(xs, ys);
  const points = xs.map((x, i) => ({ x, y: ys[i]!, date: dates[i]! }));
  let line: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (reg && xs.length >= 2) {
    let xmin = xs[0]!;
    let xmax = xs[0]!;
    for (const x of xs) {
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
    }
    line = {
      x1: xmin,
      y1: reg.intercept + reg.slope * xmin,
      x2: xmax,
      y2: reg.intercept + reg.slope * xmax,
    };
  }
  return {
    points,
    line,
    stats: { r, r2: reg?.r2 ?? null, slope: reg?.slope ?? null, n: xs.length, lagDays: lag },
  };
}

function toHistBins(hist: { edges: number[]; counts: number[] } | null) {
  if (!hist) return [];
  const out: Array<{ binStart: number; binEnd: number; count: number }> = [];
  for (let k = 0; k < hist.counts.length; k++) {
    out.push({
      binStart: hist.edges[k]!,
      binEnd: hist.edges[k + 1] ?? hist.edges[k]!,
      count: hist.counts[k]!,
    });
  }
  return out;
}

export async function Analyze(props: AnalyzeProps) {
  const { userId, days, insights, ...trends } = props;
  const from = trends.startDate;
  const to = trends.endDate;

  const [load, matrix, overlay, dists, scatters] = await Promise.all([
    safe(getLoadBalance(userId, { days: Math.max(days, 84) })),
    safe(getCorrelationMatrix(userId, { metrics: HEATMAP_METRICS, window_days: days })),
    safe(getMetricSeries(userId, { metrics: ["sleep_h", "hrv_ms"], window_days: days })),
    Promise.all(
      DIST_METRICS.map((m) =>
        safe(getDistribution(userId, { metric: m, window_days: days, bins: 12 })),
      ),
    ),
    Promise.all(PAIRS.map((p) => safe(buildScatter(userId, p.a, p.b, from, to, p.lag)))),
  ]);

  const pmcData = (load?.series ?? []).map((s) => ({
    date: s.date,
    ctl: s.ctl,
    atl: s.atl,
    tsb: s.tsb,
  }));

  const overlayData = overlay
    ? overlay.dates.map((date, i) => ({
        date,
        sleep_h: overlay.series["sleep_h"]?.[i] ?? null,
        hrv_ms: overlay.series["hrv_ms"]?.[i] ?? null,
      }))
    : [];

  const anomalies = topAnomalies(
    detectAnomalies(
      trends.daily as unknown as Parameters<typeof detectAnomalies>[0],
      trends.workouts as unknown as Parameters<typeof detectAnomalies>[1],
    ),
    6,
  );

  return (
    <div className="flex flex-col gap-10">
      {insights.length > 0 ? <InsightsFeed insights={insights} /> : null}

      {days < 90 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Wider window = stronger statistics. These cards compute over the{" "}
          {days}-day range above — try 90d or 1y for steadier correlations.
        </p>
      ) : null}

      {/* Overview — the folded Trends band (each metric links to its drilldown). */}
      <Trends {...trends} />

      <Band
        title="Training load balance"
        sub="CTL (fitness) / ATL (fatigue) / TSB (form) — EWMA τ=42d/7d. A load statistic, not a verdict."
      >
        <PerformanceManagementChart data={pmcData} />
      </Band>

      <Band title="Sleep vs HRV" sub="Two recovery signals on a shared timeline (dual axis).">
        <MultiSeriesLine
          data={overlayData}
          series={[
            { key: "sleep_h", label: "Sleep (h)", color: "var(--chart-sleep)", axis: "left", kind: "area" },
            { key: "hrv_ms", label: "HRV (ms)", color: "var(--chart-hrv)", axis: "right" },
          ]}
        />
      </Band>

      <Band
        title="Correlation matrix"
        sub="Pairwise Pearson r across recovery, load, and body signals."
      >
        {matrix ? (
          <CorrelationHeatmap
            metrics={matrix.metrics}
            matrix={matrix.matrix}
            n={matrix.n_matrix}
          />
        ) : (
          <p className="text-xs text-muted-foreground">Not enough data yet.</p>
        )}
      </Band>

      <Band title="Distributions" sub="Histogram + median marker over the window.">
        <div className="grid gap-4 sm:grid-cols-2">
          {DIST_METRICS.map((m, i) => {
            const d = dists[i];
            return (
              <div key={m} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-2 text-sm font-medium">{metricLabel(m)}</div>
                <HistogramChart
                  bins={toHistBins(d?.histogram ?? null)}
                  percentiles={{
                    p5: d?.percentiles.p5 ?? null,
                    p50: d?.percentiles.p50 ?? null,
                    p95: d?.percentiles.p95 ?? null,
                  }}
                  label={metricLabel(m)}
                />
              </div>
            );
          })}
        </div>
      </Band>

      <Band
        title="Relationships worth watching"
        sub="Scatter + OLS fit. r is a coefficient, never causation or advice."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {PAIRS.map((p, i) => {
            const s = scatters[i];
            return (
              <div key={p.title} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-2 text-sm font-medium">{p.title}</div>
                {s ? (
                  <ScatterRegression
                    points={s.points}
                    line={s.line}
                    stats={s.stats}
                    xLabel={metricLabel(p.a)}
                    yLabel={metricLabel(p.b)}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Not enough paired data.</p>
                )}
              </div>
            );
          })}
        </div>
      </Band>

      <Band title="Notable days" sub="Largest deviations from your baseline in the window.">
        {anomalies.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-xl border bg-card shadow-sm">
            {anomalies.map((a, i) => (
              <li key={`${a.date}-${a.kind}-${i}`} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-mono tabular-nums text-muted-foreground">{a.date}</span>
                <span className="flex-1 px-3">{a.message}</span>
                <span
                  className={`text-[10px] font-medium uppercase ${
                    a.severity === "high"
                      ? "text-rose-500"
                      : a.severity === "medium"
                        ? "text-amber-500"
                        : "text-muted-foreground"
                  }`}
                >
                  {a.severity}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nothing unusual in this window — every vital sat near its baseline.
          </p>
        )}
      </Band>
    </div>
  );
}

function Band({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      {children}
    </section>
  );
}
