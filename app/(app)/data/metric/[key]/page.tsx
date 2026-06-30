import Link from "next/link";
import { notFound } from "next/navigation";
import { HistogramChart } from "@/components/data/charts/histogram-chart";
import { MultiSeriesLine } from "@/components/data/charts/multi-series-line";
import { formatMetricValue, metricDef, metricLabel } from "@/lib/data-display/metric-registry";
import { METRIC_KEYS, type MetricKey } from "@/lib/mcp/tools/metrics";
import { getCorrelationMatrix } from "@/lib/mcp/tools/get-correlation-matrix";
import { getDistribution } from "@/lib/mcp/tools/get-distribution";
import { getMetricSeries } from "@/lib/mcp/tools/get-metric-series";
import { getTrend } from "@/lib/mcp/tools/get-trend";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CANDIDATES: MetricKey[] = [
  "hrv_ms",
  "rhr_bpm",
  "sleep_h",
  "sleep_score",
  "stress_score",
  "derived_sleep_debt_7d_min",
  "derived_acute_load_7d",
  "soreness",
  "fatigue",
  "weight_kg",
  "steps",
  "workout_vendor_training_load",
];

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
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

export default async function MetricPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const def = metricDef(key);
  if (!def || !(METRIC_KEYS as readonly string[]).includes(key)) notFound();
  const metric = key as MetricKey;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const candidateSet = [metric, ...CANDIDATES.filter((c) => c !== metric)].slice(0, 8);

  const [dist, trend, series, matrix] = await Promise.all([
    safe(getDistribution(user.id, { metric, window_days: 365, bins: 14 })),
    safe(getTrend(user.id, { metric, window_days: 365 })),
    safe(getMetricSeries(user.id, { metrics: [metric], window_days: 365 })),
    candidateSet.length >= 2
      ? safe(getCorrelationMatrix(user.id, { metrics: candidateSet, window_days: 365 }))
      : Promise.resolve(null),
  ]);

  const seriesData = series
    ? series.dates.map((date, i) => ({
        date,
        [metric]: series.series[metric]?.[i] ?? null,
      }))
    : [];

  // Top correlates: this metric's row in the matrix, ranked by |r|.
  const correlates: Array<{ key: string; r: number; n: number }> = [];
  if (matrix && matrix.metrics[0] === metric) {
    const row = matrix.matrix[0] ?? [];
    const nrow = matrix.n_matrix[0] ?? [];
    for (let j = 1; j < matrix.metrics.length; j++) {
      const r = row[j];
      if (r == null) continue;
      correlates.push({ key: matrix.metrics[j]!, r, n: nrow[j] ?? 0 });
    }
    correlates.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/data?view=analyze"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        ← Back to Analyze
      </Link>

      <header className="mt-3 mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{def.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Last 365 days · {dist?.n ?? 0} observations
          {def.unit ? ` · ${def.unit}` : ""}
        </p>
      </header>

      {/* Summary stats */}
      {dist ? (
        <div className="mb-8 grid grid-cols-3 gap-3 sm:grid-cols-5">
          <Stat label="Mean" value={formatMetricValue(metric, dist.mean)} />
          <Stat label="Median" value={formatMetricValue(metric, dist.median)} />
          <Stat label="Std dev" value={formatMetricValue(metric, dist.stdev)} />
          <Stat label="p5" value={formatMetricValue(metric, dist.percentiles.p5)} />
          <Stat label="p95" value={formatMetricValue(metric, dist.percentiles.p95)} />
        </div>
      ) : null}

      {/* Full-history trend */}
      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold tracking-tight">History</h2>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <MultiSeriesLine
            data={seriesData}
            series={[{ key: metric, label: def.label, color: "var(--chart-1)", axis: "left" }]}
            minN={5}
          />
          {trend && trend.direction ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Trend: {trend.direction} · {fmtSlope(trend.slope_per_30d, def.unit)} / 30d · R²{" "}
              {trend.r2 == null ? "—" : trend.r2.toFixed(2)} · n {trend.n} (OLS — a
              description, not a forecast)
            </p>
          ) : null}
        </div>
      </section>

      {/* Distribution */}
      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold tracking-tight">Distribution</h2>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <HistogramChart
            bins={toHistBins(dist?.histogram ?? null)}
            percentiles={{
              p5: dist?.percentiles.p5 ?? null,
              p50: dist?.percentiles.p50 ?? null,
              p95: dist?.percentiles.p95 ?? null,
            }}
            label={def.label}
            decimals={def.decimals}
          />
        </div>
      </section>

      {/* Top correlates */}
      <section>
        <h2 className="mb-2 text-base font-semibold tracking-tight">Top correlates</h2>
        {correlates.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-xl border bg-card shadow-sm">
            {correlates.slice(0, 6).map((c) => (
              <li key={c.key}>
                <Link
                  href={`/data/metric/${c.key}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
                >
                  <span>{metricLabel(c.key)}</span>
                  <span className="flex items-center gap-3">
                    <span
                      className={`font-mono tabular-nums ${
                        c.r >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      r {c.r >= 0 ? "+" : "−"}
                      {Math.abs(c.r).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">n {c.n}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Not enough overlapping history to rank correlates yet.
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Pearson r over the last year — a coefficient, not causation.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-sm">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}

function fmtSlope(slope: number | null, unit: string): string {
  if (slope == null) return "—";
  const s = slope >= 0 ? "+" : "−";
  return `${s}${Math.abs(slope).toFixed(2)}${unit ? ` ${unit}` : ""}`;
}
