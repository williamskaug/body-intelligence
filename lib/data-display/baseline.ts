// Personal-baseline statistics for wellness display.
//
// The point of these helpers is to make "5 = best" coloring work without
// the user ever having to know which direction is good for a given metric.
// Everything is framed relative to the user's own recent window.

export type Band = "above" | "in" | "below" | "unknown";

export type Baseline = {
  mean: number;
  median: number;
  sd: number;
  count: number;
};

export function computeBaseline(values: ReadonlyArray<number | null | undefined>): Baseline | null {
  const xs: number[] = [];
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    xs.push(Number(v));
  }
  if (xs.length < 3) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  return { mean, median, sd: Math.sqrt(variance), count: xs.length };
}

// Classify a single value against its baseline.
// `higherIsBetter`:
//   true  → above band = good (green), below = warn (amber).
//   false → above band = warn, below = good.
// For BI's 1–5 wellness scales (always "5 = best") pass `true`.
// For RHR pass `false`. For HRV pass `true`. For sleep_h pass `true`.
// Weight is `null` → neutral coloring only (no good/bad direction by default).
export function classify(
  value: number | null | undefined,
  baseline: Baseline | null,
  higherIsBetter: boolean | null = true,
  threshold = 0.5,
): { band: Band; direction: "good" | "warn" | "neutral" } {
  if (value == null || !Number.isFinite(value) || !baseline) {
    return { band: "unknown", direction: "neutral" };
  }
  const delta = Number(value) - baseline.mean;
  const cutoff = baseline.sd > 0 ? baseline.sd * threshold : 0.5;
  let band: Band;
  if (delta > cutoff) band = "above";
  else if (delta < -cutoff) band = "below";
  else band = "in";

  if (band === "in" || higherIsBetter == null) {
    return { band, direction: "neutral" };
  }
  const isGood = (band === "above") === higherIsBetter;
  return { band, direction: isGood ? "good" : "warn" };
}

// Tailwind class for a baseline-colored dot/chip background.
export function bandClass(direction: "good" | "warn" | "neutral"): string {
  switch (direction) {
    case "good":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "warn":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "neutral":
      return "bg-muted text-muted-foreground border-border";
  }
}

// Compact "delta vs baseline" string for a numeric metric, e.g. "+0.4" or "−2".
export function deltaString(
  value: number | null | undefined,
  baseline: Baseline | null,
  digits = 1,
): string | null {
  if (value == null || !Number.isFinite(value) || !baseline) return null;
  const d = Number(value) - baseline.mean;
  if (Math.abs(d) < 0.05) return "≈";
  const sign = d > 0 ? "+" : "−";
  return `${sign}${Math.abs(d).toFixed(digits)}`;
}
