// Deterministic statistics primitives — the correctness core of BI's stats
// engine. Pure functions, no DB, no React. Everything here returns a STATISTIC
// (a number, a coefficient, a fit) — never a verdict. Turning a correlation or
// a load value into "you should rest" is a judgment and belongs to Claude (a
// recipe or a conversation), never to this layer.
//
// Conventions match the rest of lib/data-display:
//   - population variance (divide by n), like computeBaseline / get_stats;
//   - degenerate input (n < 3, zero variance, all-null) returns null, never
//     NaN/Infinity.

import { computeBaseline } from "./baseline";

// Re-export so callers get the univariate baseline + the new primitives from
// one import.
export { computeBaseline } from "./baseline";
export type { Baseline } from "./baseline";

export function toFinite(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mean(xs: ReadonlyArray<number>): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function finiteOnly(values: ReadonlyArray<number | null | undefined>): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (v != null && Number.isFinite(v)) out.push(v);
  }
  return out;
}

// Type-7 (numpy/Excel default) linear-interpolation percentile over a
// pre-sorted ascending array. p in [0, 100]. Null for empty input.
export function percentile(sortedAsc: ReadonlyArray<number>, p: number): number | null {
  const n = sortedAsc.length;
  if (n === 0) return null;
  if (n === 1) return sortedAsc[0]!;
  const idx = (p / 100) * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  return sortedAsc[lo]! + (idx - lo) * (sortedAsc[hi]! - sortedAsc[lo]!);
}

// Sorts once, returns one percentile per p. Null entries for empty input.
export function quantiles(
  values: ReadonlyArray<number | null | undefined>,
  ps: ReadonlyArray<number>,
): Array<number | null> {
  const xs = finiteOnly(values).sort((a, b) => a - b);
  return ps.map((p) => percentile(xs, p));
}

export type Histogram = {
  bins: number;
  bin_width: number;
  edges: number[]; // length bins + 1
  counts: number[]; // length bins
};

// Equal-width histogram. Deterministic binning: edges from min to max, the max
// value falls in the last bin (right edge inclusive only there). Zero-range
// data (max === min) collapses to a single bin. Null for empty input.
export function histogram(
  values: ReadonlyArray<number | null | undefined>,
  bins: number,
): Histogram | null {
  const xs = finiteOnly(values);
  const n = xs.length;
  if (n === 0) return null;
  let min = xs[0]!;
  let max = xs[0]!;
  for (const v of xs) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max === min) {
    return { bins: 1, bin_width: 0, edges: [min, min], counts: [n] };
  }
  const width = (max - min) / bins;
  const edges: number[] = [];
  for (let k = 0; k <= bins; k++) edges.push(min + k * width);
  const counts = new Array<number>(bins).fill(0);
  for (const v of xs) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    counts[idx]! += 1;
  }
  return { bins, bin_width: width, edges, counts };
}

export type FinitePair = { xs: number[]; ys: number[]; n: number };

// Keep only index-aligned pairs where BOTH values are finite.
export function pairFinite(
  xs: ReadonlyArray<number | null | undefined>,
  ys: ReadonlyArray<number | null | undefined>,
): FinitePair {
  const a: number[] = [];
  const b: number[] = [];
  const len = Math.min(xs.length, ys.length);
  for (let i = 0; i < len; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) {
      a.push(x);
      b.push(y);
    }
  }
  return { xs: a, ys: b, n: a.length };
}

// Pearson correlation coefficient. Null on n < 3 or zero variance in either
// series (the constant-metric guard — avoids NaN). Clamped to [-1, 1].
export function pearson(
  xs: ReadonlyArray<number | null | undefined>,
  ys: ReadonlyArray<number | null | undefined>,
): number | null {
  const { xs: a, ys: b, n } = pairFinite(xs, ys);
  if (n < 3) return null;
  const mx = mean(a);
  const my = mean(b);
  let cov = 0;
  let sx2 = 0;
  let sy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = a[i]! - mx;
    const dy = b[i]! - my;
    cov += dx * dy;
    sx2 += dx * dx;
    sy2 += dy * dy;
  }
  const denom = Math.sqrt(sx2 * sy2);
  if (denom === 0) return null;
  const r = cov / denom;
  if (!Number.isFinite(r)) return null;
  return Math.max(-1, Math.min(1, r));
}

// Average-rank assignment (ties share the mean of their ranks), 1-based.
export function rankAverage(xs: ReadonlyArray<number>): number[] {
  const order = xs.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v);
  const ranks = new Array<number>(xs.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]!.v === order[i]!.v) j += 1;
    const avgRank = (i + j) / 2 + 1; // ranks are 1-based
    for (let k = i; k <= j; k++) ranks[order[k]!.i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

// Spearman rank correlation — Pearson over average ranks. Detects monotonic
// (not necessarily linear) association. Null on n < 3.
export function spearman(
  xs: ReadonlyArray<number | null | undefined>,
  ys: ReadonlyArray<number | null | undefined>,
): number | null {
  const { xs: a, ys: b, n } = pairFinite(xs, ys);
  if (n < 3) return null;
  return pearson(rankAverage(a), rankAverage(b));
}

export type Regression = { slope: number; intercept: number; r2: number; n: number };

// Ordinary-least-squares fit of y on x. Null on n < 3 or zero x-variance.
export function linregress(
  xs: ReadonlyArray<number | null | undefined>,
  ys: ReadonlyArray<number | null | undefined>,
): Regression | null {
  const { xs: a, ys: b, n } = pairFinite(xs, ys);
  if (n < 3) return null;
  const mx = mean(a);
  const my = mean(b);
  let cov = 0;
  let sx2 = 0;
  let sy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = a[i]! - mx;
    const dy = b[i]! - my;
    cov += dx * dy;
    sx2 += dx * dx;
    sy2 += dy * dy;
  }
  if (sx2 === 0) return null;
  const slope = cov / sx2;
  const intercept = my - slope * mx;
  const r2 = sy2 === 0 ? 0 : (cov * cov) / (sx2 * sy2);
  return { slope, intercept, r2, n };
}

// Exponentially-weighted moving average over a dense series (gaps must already
// be filled — for training load, 0). alpha = 1 - e^(-1/tau) (continuous-decay
// form: tau=7 → ~0.1331, tau=42 → ~0.0235). A constant series stays constant.
export function ewma(
  series: ReadonlyArray<number>,
  tau: number,
  seed = 0,
): number[] {
  const alpha = 1 - Math.exp(-1 / tau);
  const out: number[] = [];
  let prev = seed;
  for (const v of series) {
    prev = prev + alpha * (v - prev);
    out.push(prev);
  }
  return out;
}

// Add `delta` days to a YYYY-MM-DD date (UTC), matching the rest of the repo.
export function addDaysISO(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export type Aligned = { xs: number[]; ys: number[]; dates: string[] };

// Pair series A at day d with series B at day d+lagDays. A positive lag asks
// "A today vs B tomorrow" (a=load, b=hrv, lag=1). Non-overlapping dates drop.
export function alignByDate(
  a: ReadonlyMap<string, number>,
  b: ReadonlyMap<string, number>,
  lagDays: number,
): Aligned {
  const xs: number[] = [];
  const ys: number[] = [];
  const dates: string[] = [];
  const sortedDates = Array.from(a.keys()).sort();
  for (const d of sortedDates) {
    const av = a.get(d);
    if (av === undefined) continue;
    const d2 = lagDays === 0 ? d : addDaysISO(d, lagDays);
    const bv = b.get(d2);
    if (bv === undefined) continue;
    xs.push(av);
    ys.push(bv);
    dates.push(d);
  }
  return { xs, ys, dates };
}

// Project a date→value map onto a date axis, leaving gaps as null.
export function denseSeries(
  map: ReadonlyMap<string, number>,
  dates: ReadonlyArray<string>,
): Array<number | null> {
  return dates.map((d) => {
    const v = map.get(d);
    return v === undefined ? null : v;
  });
}

export type CorrelationReport = {
  n: number;
  pearson_r: number | null;
  spearman_r: number | null;
  regression: Regression | null;
};

// Compose alignment + Pearson + Spearman + OLS for a metric pair. This is the
// unit the get_correlation tool delegates to (no DB).
export function correlationReport(
  a: ReadonlyMap<string, number>,
  b: ReadonlyMap<string, number>,
  lagDays: number,
): CorrelationReport {
  const { xs, ys } = alignByDate(a, b, lagDays);
  return {
    n: xs.length,
    pearson_r: pearson(xs, ys),
    spearman_r: spearman(xs, ys),
    regression: linregress(xs, ys),
  };
}

// Edwards' TRIMP — a published zone-weighted training-load formula: minutes in
// HR zone i count i× (Z1×1 … Z5×5). zoneSeconds is [z1..z5] in seconds. Pure
// math with constants in code, like any other statistic here.
export function edwardsTrimp(zoneSeconds: ReadonlyArray<number | null>): number {
  let trimp = 0;
  for (let i = 0; i < zoneSeconds.length && i < 5; i++) {
    const s = zoneSeconds[i];
    if (s != null && Number.isFinite(s) && s > 0) trimp += (s / 60) * (i + 1);
  }
  return trimp;
}

// 95% confidence interval for a Pearson r via the Fisher z-transform:
// CI = tanh(atanh(r) ± 1.96/√(n−3)). Null when n < 4 or r is null. Lets a CI
// spanning 0 read as "not distinguishable from zero".
export function fisherCI(r: number | null, n: number): [number, number] | null {
  if (r == null || n < 4 || !Number.isFinite(r)) return null;
  const rc = Math.max(-0.999999, Math.min(0.999999, r));
  const z = Math.atanh(rc);
  const se = 1 / Math.sqrt(n - 3);
  const lo = Math.tanh(z - 1.96 * se);
  const hi = Math.tanh(z + 1.96 * se);
  return [Math.max(-1, lo), Math.min(1, hi)];
}

export type LagPoint = { lag: number; r: number | null; n: number };

// Pearson r of (a vs b) at each lag (b shifted +lag days). Returns the full
// profile plus the strongest lag by |r| among lags meeting minN. Cheap — it
// re-aligns the already-fetched maps in memory, no extra queries.
export function lagScan(
  a: ReadonlyMap<string, number>,
  b: ReadonlyMap<string, number>,
  lags: ReadonlyArray<number>,
  minN = 8,
): { profile: LagPoint[]; best: LagPoint | null } {
  const profile: LagPoint[] = [];
  for (const lag of lags) {
    const { xs, ys } = alignByDate(a, b, lag);
    profile.push({ lag, r: pearson(xs, ys), n: xs.length });
  }
  let best: LagPoint | null = null;
  for (const p of profile) {
    if (p.r == null || p.n < minN) continue;
    if (best == null || Math.abs(p.r) > Math.abs(best.r!)) best = p;
  }
  return { profile, best };
}

// Keep computeBaseline reachable from this module for callers that want the
// univariate mean/median/sd alongside the new primitives.
export const baseline = computeBaseline;
