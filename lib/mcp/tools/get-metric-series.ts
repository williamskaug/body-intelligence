import { z } from "zod";
import { multiSeries, type DailyAgg } from "@/lib/data-display/metric-series";
import { dateString } from "./shared";
import { METRIC_KEYS } from "./metrics";
import { resolveRange } from "./stats-shared";

export const getMetricSeriesInputSchema = {
  metrics: z.array(z.enum(METRIC_KEYS)).min(1).max(8),
  window_days: z.number().int().min(3).max(365).default(90),
  from_date: dateString.optional(),
  to_date: dateString.optional(),
  agg_overrides: z
    .record(z.string(), z.enum(["sum", "mean", "max"]))
    .optional()
    .describe("Per-metric override of the default daily collapse for per-workout metrics, keyed by metric name."),
};

export type GetMetricSeriesInput = {
  metrics: Array<(typeof METRIC_KEYS)[number]>;
  window_days?: number;
  from_date?: string;
  to_date?: string;
  agg_overrides?: Record<string, DailyAgg>;
};

export async function getMetricSeries(userId: string, input: GetMetricSeriesInput) {
  const { from, to } = resolveRange(input);
  const result = await multiSeries(
    userId,
    input.metrics,
    from,
    to,
    input.agg_overrides ?? {},
  );

  return {
    metrics: input.metrics,
    range: { from, to },
    agg_used: result.agg_used,
    dates: result.dates,
    series: result.series,
    counts: result.counts,
    note: "Date-aligned daily series on a dense axis (gaps = null). Per-workout metrics are collapsed per day by agg_used. Raw data for charts/scatter — no interpretation.",
  };
}
