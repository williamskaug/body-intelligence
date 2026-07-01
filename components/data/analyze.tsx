import Link from "next/link";
import { Trends } from "./trends";
import { InsightsFeed, type InsightDoc } from "./insights-feed";
import { CorrelationHeatmap } from "./charts/correlation-heatmap";
import { HistogramChart } from "./charts/histogram-chart";
import { MultiSeriesLine } from "./charts/multi-series-line";
import { PerformanceManagementChart } from "./charts/performance-management-chart";
import { RatioBandChart } from "./charts/ratio-band-chart";
import { ScatterRegression } from "./charts/scatter-regression";
import { BaselineBandChart } from "./charts/baseline-band-chart";
import { ChartEmpty } from "./charts/chart-empty";
import { detectAnomalies, topAnomalies } from "@/lib/data-display/anomalies";
import {
  formatMetricValue,
  formatSeconds,
  metricDef,
  metricLabel,
} from "@/lib/data-display/metric-registry";
import { dailySeriesForMetric } from "@/lib/data-display/metric-series";
import {
  alignByDate,
  computeBaseline,
  fisherCI,
  lagScan,
  linregress,
  pearson,
} from "@/lib/data-display/statistics";
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
  // Parsed A-race goal joined to its capacity prediction (null if unparseable).
  raceReadiness: {
    predKey: string;
    goalSeconds: number;
    daysOut: number;
    label: string;
  } | null;
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

const CAPACITY_KEYS: MetricKey[] = [
  "capacity_vo2max_running",
  "capacity_vo2max_cycling",
  "capacity_cycling_ftp_w",
  "capacity_lactate_threshold_pace_s_per_km",
  "capacity_race_pred_5k_s",
  "capacity_race_pred_10k_s",
  "capacity_race_pred_half_s",
  "capacity_race_pred_marathon_s",
];

const ZONE_KEYS: MetricKey[] = [
  "workout_hr_z1_s",
  "workout_hr_z2_s",
  "workout_hr_z3_s",
  "workout_hr_z4_s",
  "workout_hr_z5_s",
];

const PAIRS: Array<{ a: MetricKey; b: MetricKey; title: string }> = [
  { a: "sleep_h", b: "hrv_ms", title: "Sleep → HRV" },
  { a: "derived_acute_load_7d", b: "soreness", title: "Acute load → soreness" },
  { a: "workout_weather_temp_c", b: "workout_decoupling_pct", title: "Heat → HR-pace decoupling" },
  { a: "rhr_bpm", b: "sleep_quality", title: "Resting HR → sleep quality" },
];

// Lags (days) scanned for each relationship — b shifted forward by the lag.
const SCAN_LAGS = [0, 1, 2, 3];

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

function latestNonNull(arr: ReadonlyArray<number | null> | undefined): number | null {
  if (!arr) return null;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]!;
  return null;
}
function firstNonNull(arr: ReadonlyArray<number | null> | undefined): number | null {
  if (!arr) return null;
  for (let i = 0; i < arr.length; i++) if (arr[i] != null) return arr[i]!;
  return null;
}
function sumNonNull(arr: ReadonlyArray<number | null> | undefined): number {
  if (!arr) return 0;
  let s = 0;
  for (const v of arr) if (v != null) s += v;
  return s;
}

const MIN_PAIRS = 12;

async function buildScatter(userId: string, a: MetricKey, b: MetricKey, from: string, to: string) {
  const [sa, sb] = await Promise.all([
    dailySeriesForMetric(userId, a, from, to),
    dailySeriesForMetric(userId, b, from, to),
  ]);
  // Scan forward lags, but ANCHOR on lag 0 to avoid multiple-comparison
  // inflation — only promote a nonzero lag when it clearly beats lag 0 AND its
  // Fisher-z CI excludes 0. Otherwise the same-day relationship is shown.
  const { profile } = lagScan(sa.map, sb.map, SCAN_LAGS, MIN_PAIRS);
  const lag0 = profile.find((p) => p.lag === 0);
  let bestNonZero: { lag: number; r: number | null; n: number } | null = null;
  for (const p of profile) {
    if (p.lag === 0 || p.r == null || p.n < MIN_PAIRS) continue;
    if (bestNonZero == null || Math.abs(p.r) > Math.abs(bestNonZero.r!)) bestNonZero = p;
  }
  let chosenLag = 0;
  const l0mag = lag0?.r != null ? Math.abs(lag0.r) : 0;
  if (bestNonZero?.r != null) {
    const bci = fisherCI(bestNonZero.r, bestNonZero.n);
    const excludesZero = bci != null && (bci[0] > 0 || bci[1] < 0);
    if (Math.abs(bestNonZero.r) > l0mag + 0.1 && excludesZero) chosenLag = bestNonZero.lag;
  }

  const { xs, ys, dates } = alignByDate(sa.map, sb.map, chosenLag);
  const reg = linregress(xs, ys);
  const r = pearson(xs, ys);
  const ci = fisherCI(r, xs.length);
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
    stats: { r, r2: reg?.r2 ?? null, slope: reg?.slope ?? null, n: xs.length, lagDays: chosenLag, ci },
    lagProfile: profile.map((p) => ({ lag: p.lag, r: p.r })),
  };
}

function buildBaselineBand(
  key: string,
  ms: { dates: string[]; series: Record<string, Array<number | null>> } | null,
) {
  const series = ms?.series[key];
  if (!series || !ms) return null;
  const data = ms.dates.map((date, i) => ({ date, value: series[i] ?? null }));
  // Leave-one-out: baseline is the prior distribution (excluding today's value),
  // so the z-score measures deviation from a set the point doesn't belong to.
  let latestIdx = -1;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) {
      latestIdx = i;
      break;
    }
  }
  const latest = latestIdx >= 0 ? series[latestIdx]! : null;
  const prior = series.filter((v, i) => v != null && i !== latestIdx);
  const base = computeBaseline(prior);
  const z = base && base.sd > 0 && latest != null ? (latest - base.mean) / base.sd : null;
  return { data, mean: base?.mean ?? null, sd: base?.sd ?? null, z };
}

// Drop matrix rows/cols whose metric has fewer than minCoverage self-samples
// (the lag-0 diagonal count), so the heatmap isn't a mostly-empty grid of "·".
function pruneMatrix(
  metrics: ReadonlyArray<string>,
  mat: ReadonlyArray<ReadonlyArray<number | null>>,
  n: ReadonlyArray<ReadonlyArray<number>>,
  minCoverage: number,
) {
  const keep: number[] = [];
  for (let i = 0; i < metrics.length; i++) {
    if ((n[i]?.[i] ?? 0) >= minCoverage) keep.push(i);
  }
  return {
    metrics: keep.map((i) => metrics[i]!),
    matrix: keep.map((i) => keep.map((j) => mat[i]![j] ?? null)),
    n: keep.map((i) => keep.map((j) => n[i]![j] ?? 0)),
    dropped: metrics.length - keep.length,
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
  const { userId, days, insights, raceReadiness, ...trends } = props;
  const from = trends.startDate;
  const to = trends.endDate;

  const [load, matrix, overlay, dists, scatters, capacity, zones, head, distLatest, recoveryBase] =
    await Promise.all([
      safe(getLoadBalance(userId, { days: Math.max(days, 84) })),
      safe(getCorrelationMatrix(userId, { metrics: HEATMAP_METRICS, window_days: days })),
      safe(getMetricSeries(userId, { metrics: ["sleep_h", "hrv_ms"], window_days: days })),
      Promise.all(
        DIST_METRICS.map((m) =>
          safe(getDistribution(userId, { metric: m, window_days: days, bins: 12 })),
        ),
      ),
      Promise.all(PAIRS.map((p) => safe(buildScatter(userId, p.a, p.b, from, to)))),
      safe(getMetricSeries(userId, { metrics: CAPACITY_KEYS, window_days: days })),
      safe(getMetricSeries(userId, { metrics: ZONE_KEYS, window_days: days })),
      safe(getMetricSeries(userId, { metrics: ["hrv_ms", "derived_sleep_debt_7d_min"], window_days: days })),
      safe(getMetricSeries(userId, { metrics: DIST_METRICS, window_days: days })),
      // Recovery baselines use a FIXED 60-day window regardless of the display
      // range, so a day's z/normal-range doesn't shift with the 7d/30d/90d toggle.
      safe(getMetricSeries(userId, { metrics: ["hrv_ms", "rhr_bpm", "sleep_h"], window_days: 60 })),
    ]);

  // ---- Headline strip inputs (all deterministic differences) ----
  const hrvSeries = head?.series["hrv_ms"];
  const hrvLatest = latestNonNull(hrvSeries);
  const hrvBaseline = computeBaseline(hrvSeries ?? [])?.mean ?? null;
  const sleepDebtLatest = latestNonNull(head?.series["derived_sleep_debt_7d_min"]);
  const vo2Latest = latestNonNull(capacity?.series["capacity_vo2max_running"]);
  const vo2First = firstNonNull(capacity?.series["capacity_vo2max_running"]);

  const pmcData = (load?.series ?? []).map((s) => ({
    date: s.date,
    ctl: s.ctl,
    atl: s.atl,
    tsb: s.tsb,
  }));
  const acwrData = (load?.series ?? []).map((s) => ({ date: s.date, value: s.acwr }));

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

  // ---- Polarization (HR time-in-zone over the window) ----
  const z1 = sumNonNull(zones?.series["workout_hr_z1_s"]);
  const z2 = sumNonNull(zones?.series["workout_hr_z2_s"]);
  const z3 = sumNonNull(zones?.series["workout_hr_z3_s"]);
  const z4 = sumNonNull(zones?.series["workout_hr_z4_s"]);
  const z5 = sumNonNull(zones?.series["workout_hr_z5_s"]);
  const zoneTotal = z1 + z2 + z3 + z4 + z5;

  return (
    <div className="flex flex-col gap-10">
      {insights.length > 0 ? <InsightsFeed insights={insights} /> : null}

      {/* Headline strip — state + trajectory in the first 3 seconds. Each chip is
          the sign of a single deterministic delta; never a fused readiness verdict. */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <HeadStat
            label="Fitness (CTL)"
            value={fmt0(load?.current.ctl)}
            delta={deltaChip(load?.current.ctl_ramp_7d ?? null, 0, true, 0, "/wk")}
          />
          <HeadStat label="Form (TSB)" value={fmtSigned0(load?.current.tsb)} tone="neutral" />
          <HeadStat
            label="Acute:chronic"
            value={load?.current.acwr != null ? load.current.acwr.toFixed(2) : "—"}
            sub="0.8–1.3 typical"
            tone="neutral"
          />
          <HeadStat
            label="HRV"
            value={hrvLatest != null ? `${Math.round(hrvLatest)} ms` : "—"}
            delta={deltaChip(hrvLatest, hrvBaseline, true, 0, "")}
          />
          <HeadStat
            label="Sleep debt"
            value={sleepDebtLatest != null ? `${Math.round(sleepDebtLatest)}m` : "—"}
            tone={sleepDebtLatest != null && sleepDebtLatest >= 180 ? "warn" : "neutral"}
          />
          <HeadStat
            label="VO₂max"
            value={vo2Latest != null ? vo2Latest.toFixed(1) : "—"}
            delta={deltaChip(vo2Latest, vo2First, true, 1, "")}
          />
        </div>
      </section>

      {/* Notable days — promoted near the top; the most engaging glance. */}
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

      {/* Overview — the folded Trends band (each metric links to its drilldown). */}
      <Trends {...trends} />

      <Band
        title="Training load balance"
        sub="CTL (fitness) / ATL (fatigue) / TSB (form) — EWMA τ=42d/7d. Load statistics, not a verdict."
      >
        <PerformanceManagementChart data={pmcData} ramp={load?.current.ctl_ramp_7d ?? null} />
        {load ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-xs text-muted-foreground">
              Monotony{" "}
              <span className="font-mono text-foreground">
                {load.current.monotony != null ? load.current.monotony.toFixed(2) : "—"}
              </span>{" "}
              · Strain{" "}
              <span className="font-mono text-foreground">{fmt0(load.current.strain)}</span>{" "}
              (Foster — 7-day mean/SD of load × weekly load)
            </span>
            <span className="text-[11px] text-muted-foreground">
              Load source: {load.load_sources.zones} zone-TRIMP · {load.load_sources.vendor}{" "}
              vendor · {load.load_sources.rpe} RPE-estimated
              {load.workouts_excluded > 0
                ? ` · ${load.workouts_excluded} non-endurance excluded (golf/walk/…)`
                : ""}
            </span>
          </div>
        ) : null}
      </Band>

      <Band
        title="Acute:chronic workload ratio"
        sub="ATL ÷ CTL. The shaded 0.8–1.3 band is a commonly-cited range — context, not a verdict; interpretation is Claude's job."
      >
        <RatioBandChart data={acwrData} band={[0.8, 1.3]} refLine={1} label="ACWR" />
      </Band>

      {/* Fitness & capacity — "is my engine getting bigger?" */}
      <Band
        title="Fitness & capacity"
        sub="VO₂max, FTP, and race-time predictions over the window — the clearest proof training is working."
      >
        {raceReadiness
          ? (() => {
              const latest = latestNonNull(capacity?.series[raceReadiness.predKey]);
              const goal = raceReadiness.goalSeconds;
              const ahead = latest != null && latest <= goal;
              return (
                <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm">
                  <div className="text-sm font-medium">
                    Race readiness · {raceReadiness.label}
                  </div>
                  {latest != null ? (
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                      <span className="font-mono text-lg tabular-nums">{formatSeconds(latest)}</span>
                      <span className="text-muted-foreground">predicted</span>
                      <span className="text-muted-foreground">
                        vs goal {formatSeconds(goal)}
                      </span>
                      <span className={ahead ? "text-emerald-500" : "text-rose-500"}>
                        {ahead ? "ahead of" : "behind"} goal by {formatSeconds(Math.abs(latest - goal))}
                      </span>
                      {raceReadiness.daysOut >= 0 ? (
                        <span className="text-muted-foreground">· {raceReadiness.daysOut}d to race</span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No race prediction captured yet — capacity-sync will fill this (goal{" "}
                      {formatSeconds(goal)}
                      {raceReadiness.daysOut >= 0 ? `, ${raceReadiness.daysOut}d out` : ""}).
                    </p>
                  )}
                </div>
              );
            })()
          : null}
        {capacity && CAPACITY_KEYS.some((k) => firstNonNull(capacity.series[k]) != null) ? (
          <div className="flex flex-col gap-4">
            <MultiSeriesLine
              data={capacity.dates.map((date, i) => ({
                date,
                capacity_vo2max_running: capacity.series["capacity_vo2max_running"]?.[i] ?? null,
                capacity_cycling_ftp_w: capacity.series["capacity_cycling_ftp_w"]?.[i] ?? null,
              }))}
              series={[
                { key: "capacity_vo2max_running", label: "VO₂max (run)", color: "var(--chart-hrv)", axis: "left" },
                { key: "capacity_cycling_ftp_w", label: "FTP (W)", color: "var(--chart-load)", axis: "right" },
              ]}
              minN={2}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {CAPACITY_KEYS.map((k) => {
                const series = capacity.series[k];
                const latest = latestNonNull(series);
                const first = firstNonNull(series);
                if (latest == null) return null;
                const def = metricDef(k);
                const lowerIsBetter = def?.higherIsBetter === false;
                return (
                  <Link
                    key={k}
                    href={`/data/metric/${k}`}
                    className="rounded-lg border bg-card px-3 py-2 shadow-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {metricLabel(k)}
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span className="font-mono text-sm tabular-nums">
                        {formatMetricValue(k, latest)}
                      </span>
                      {capacityDelta(k, latest, first, lowerIsBetter)}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <ChartEmpty label="No capacity snapshots yet — your dawn agent isn't capturing capacity. Install the capacity-sync recipe (or run the backfill) to pull VO₂max / FTP / race predictions." />
        )}
      </Band>

      {/* Intensity distribution / polarization */}
      <Band
        title="Intensity distribution"
        sub="Time in HR zones over the window. ≈80% easy is the commonly-cited polarized target — descriptive, not advice."
      >
        {zoneTotal > 0 ? (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex h-6 w-full overflow-hidden rounded-md">
              <Seg pct={(z1 + z2) / zoneTotal} color="var(--chart-tsb)" />
              <Seg pct={z3 / zoneTotal} color="var(--chart-load)" />
              <Seg pct={(z4 + z5) / zoneTotal} color="var(--chart-atl)" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <ZoneLegend label="Easy (Z1–2)" color="var(--chart-tsb)" secs={z1 + z2} total={zoneTotal} />
              <ZoneLegend label="Threshold (Z3)" color="var(--chart-load)" secs={z3} total={zoneTotal} />
              <ZoneLegend label="Hard (Z4–5)" color="var(--chart-atl)" secs={z4 + z5} total={zoneTotal} />
            </div>
          </div>
        ) : (
          <ChartEmpty label="No HR-zone data yet — your dawn agent isn't capturing per-activity HR zones. Update its recipe (or run the backfill) to light this up." />
        )}
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
        title="Recovery baselines"
        sub="Each signal against its own ±1 SD normal range over a fixed 60-day window, with today's leave-one-out z-score. Descriptive — never a readiness gate (that stays the agent's call)."
      >
        <div className="grid gap-4">
          {[
            { key: "hrv_ms", color: "var(--chart-hrv)", dec: 0, unit: "ms" },
            { key: "rhr_bpm", color: "var(--chart-rhr)", dec: 0, unit: "bpm" },
            { key: "sleep_h", color: "var(--chart-sleep)", dec: 1, unit: "h" },
          ].map((cfg) => {
            const bb = buildBaselineBand(cfg.key, recoveryBase);
            if (!bb) return null;
            return (
              <div key={cfg.key} className="rounded-xl border bg-card p-4 shadow-sm">
                <BaselineBandChart
                  data={bb.data}
                  mean={bb.mean}
                  sd={bb.sd}
                  label={metricLabel(cfg.key)}
                  unit={cfg.unit}
                  color={cfg.color}
                  decimals={cfg.dec}
                  todayZ={bb.z}
                />
              </div>
            );
          })}
        </div>
      </Band>

      <Band
        title="Correlation matrix"
        sub="Pairwise Pearson r across recovery, load, and body signals — saturation ∝ |r|, low-n cells faded."
      >
        {(() => {
          const pruned = matrix
            ? pruneMatrix(matrix.metrics, matrix.matrix, matrix.n_matrix, 12)
            : null;
          if (!pruned || pruned.metrics.length < 3) {
            return (
              <p className="text-xs text-muted-foreground">
                Not enough overlapping history yet — the matrix needs ≥3 metrics with ~12+
                logged days each. Right now only HRV / RHR / sleep have that.
              </p>
            );
          }
          return (
            <>
              <CorrelationHeatmap
                metrics={pruned.metrics}
                matrix={pruned.matrix}
                n={pruned.n}
              />
              {pruned.dropped > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {pruned.dropped} metric{pruned.dropped === 1 ? "" : "s"} hidden for
                  insufficient data (e.g. soreness, weight, sleep debt).
                </p>
              ) : null}
            </>
          );
        })()}
      </Band>

      <Band title="Distributions" sub="Histogram + median + your latest value over the window.">
        <div className="grid gap-4 sm:grid-cols-2">
          {DIST_METRICS.map((m, i) => {
            const d = dists[i];
            return (
              <div key={m} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-medium">{metricLabel(m)}</span>
                  {d?.percentiles.p50 != null ? (
                    <span className="text-[10px] text-muted-foreground">
                      median {formatMetricValue(m, d.percentiles.p50)}
                    </span>
                  ) : null}
                </div>
                <HistogramChart
                  bins={toHistBins(d?.histogram ?? null)}
                  percentiles={{
                    p5: d?.percentiles.p5 ?? null,
                    p50: d?.percentiles.p50 ?? null,
                    p95: d?.percentiles.p95 ?? null,
                  }}
                  latest={latestNonNull(distLatest?.series[m as string])}
                  label={metricLabel(m)}
                  decimals={metricDef(m)?.decimals ?? 1}
                />
              </div>
            );
          })}
        </div>
      </Band>

      <Band
        title="Relationships worth watching"
        sub="Scatter + OLS fit. r is a coefficient with its n, never causation or advice."
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
                    lagProfile={s.lagProfile}
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

      {days < 90 ? (
        <p className="text-center text-[11px] text-muted-foreground">
          Correlation and distribution cards strengthen with a wider window — try 90d or 1y.
        </p>
      ) : null}
    </div>
  );
}

// ---- small presentational helpers ----

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

function HeadStat({
  label,
  value,
  delta,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
  sub?: string;
  tone?: "neutral" | "warn";
}) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={`font-mono text-lg tabular-nums ${tone === "warn" ? "text-amber-500" : ""}`}
        >
          {value}
        </span>
        {delta}
      </div>
      {sub ? <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function deltaChip(
  curr: number | null,
  ref: number | null,
  higherIsBetter: boolean | null,
  decimals: number,
  unit: string,
): React.ReactNode {
  if (curr == null || ref == null) return null;
  const d = curr - ref;
  if (Math.abs(d) < Math.pow(10, -decimals - 1)) return null;
  const tone =
    higherIsBetter == null ? "text-muted-foreground" : (d > 0) === higherIsBetter ? "text-emerald-500" : "text-rose-500";
  const arrow = d > 0 ? "↑" : "↓";
  return (
    <span className={`text-[11px] font-medium ${tone}`}>
      {arrow}
      {Math.abs(d).toFixed(decimals)}
      {unit}
    </span>
  );
}

function capacityDelta(
  key: string,
  latest: number,
  first: number | null,
  lowerIsBetter: boolean,
): React.ReactNode {
  if (first == null) return null;
  const d = latest - first;
  if (d === 0) return null;
  const improving = lowerIsBetter ? d < 0 : d > 0;
  const tone = improving ? "text-emerald-500" : "text-rose-500";
  const arrow = d > 0 ? "↑" : "↓";
  const def = metricDef(key);
  const mag =
    def?.kind === "duration" || def?.kind === "pace"
      ? formatSeconds(Math.abs(d))
      : Math.abs(d).toFixed(def?.decimals ?? 1);
  return (
    <span className={`text-[11px] font-medium ${tone}`}>
      {arrow}
      {mag}
    </span>
  );
}

function Seg({ pct, color }: { pct: number; color: string }) {
  if (pct <= 0) return null;
  return <div style={{ width: `${pct * 100}%`, backgroundColor: color }} />;
}

function ZoneLegend({
  label,
  color,
  secs,
  total,
}: {
  label: string;
  color: string;
  secs: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((secs / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: color }} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className="font-mono tabular-nums">
        {pct}% · {formatSeconds(secs)}
      </span>
    </div>
  );
}

function fmt0(x: number | null | undefined): string {
  return x == null ? "—" : Math.round(x).toString();
}
function fmtSigned0(x: number | null | undefined): string {
  if (x == null) return "—";
  return `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x))}`;
}
