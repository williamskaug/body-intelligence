import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { computeBaseline, histogram, quantiles } from "@/lib/data-display/statistics";
import { dateString } from "./shared";
import { METRIC_KEYS, resolveMetric } from "./metrics";
import { resolveRange, round } from "./stats-shared";

export const getDistributionInputSchema = {
  metric: z.enum(METRIC_KEYS),
  window_days: z.number().int().min(3).max(365).default(90),
  from_date: dateString.optional(),
  to_date: dateString.optional(),
  bins: z.number().int().min(2).max(50).default(10),
};

export type GetDistributionInput = {
  metric: (typeof METRIC_KEYS)[number];
  window_days?: number;
  from_date?: string;
  to_date?: string;
  bins?: number;
};

export async function getDistribution(userId: string, input: GetDistributionInput) {
  const { from, to } = resolveRange(input);
  const { table, column } = resolveMetric(input.metric);
  const bins = input.bins ?? 10;
  const sb = adminClient();

  // Raw values in range (one per workout for workout metrics, one per day for
  // daily metrics) — consistent with get_stats, so a histogram of "avg_hr
  // across workouts" is the natural per-workout distribution.
  const { data, error } = await sb
    .from(table)
    .select(column)
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to);
  if (error) throw new Error(`get_distribution ${input.metric}: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const xs: number[] = [];
  for (const row of rows) {
    const v = row[column];
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) xs.push(n);
  }

  const base = computeBaseline(xs);
  const [p5, p25, p50, p75, p95] = quantiles(xs, [5, 25, 50, 75, 95]);
  let min: number | null = null;
  let max: number | null = null;
  for (const v of xs) {
    if (min == null || v < min) min = v;
    if (max == null || v > max) max = v;
  }

  return {
    metric: input.metric,
    range: { from, to },
    n: xs.length,
    min: round(min),
    max: round(max),
    mean: round(base?.mean ?? null),
    median: round(base?.median ?? null),
    stdev: round(base?.sd ?? null),
    percentiles: {
      p5: round(p5),
      p25: round(p25),
      p50: round(p50),
      p75: round(p75),
      p95: round(p95),
    },
    histogram: histogram(xs, bins),
    note: "Empirical distribution over raw values in the window: histogram + percentiles + moments. Descriptive only.",
  };
}
