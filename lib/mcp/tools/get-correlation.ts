import { z } from "zod";
import { correlationReport } from "@/lib/data-display/statistics";
import { dailySeriesForMetric, type DailyAgg } from "@/lib/data-display/metric-series";
import { dateString } from "./shared";
import { METRIC_KEYS } from "./metrics";
import { resolveRange, round } from "./stats-shared";

const AGG = z.enum(["sum", "mean", "max"]);

export const getCorrelationInputSchema = {
  metric_a: z.enum(METRIC_KEYS),
  metric_b: z.enum(METRIC_KEYS),
  window_days: z.number().int().min(3).max(365).default(90),
  from_date: dateString.optional(),
  to_date: dateString.optional(),
  lag_days: z
    .number()
    .int()
    .min(-30)
    .max(30)
    .default(0)
    .describe(
      "+N pairs metric_a at day d with metric_b at day d+N: 'training load today vs HRV tomorrow' = metric_a=load, metric_b=hrv, lag_days=1.",
    ),
  agg_a: AGG.optional().describe("Override the daily collapse for a per-workout metric_a (default: sum/mean/max by metric class)."),
  agg_b: AGG.optional(),
};

export type GetCorrelationInput = {
  metric_a: (typeof METRIC_KEYS)[number];
  metric_b: (typeof METRIC_KEYS)[number];
  window_days?: number;
  from_date?: string;
  to_date?: string;
  lag_days?: number;
  agg_a?: DailyAgg;
  agg_b?: DailyAgg;
};

export async function getCorrelation(userId: string, input: GetCorrelationInput) {
  const { from, to } = resolveRange(input);
  const lag = input.lag_days ?? 0;
  const a = await dailySeriesForMetric(userId, input.metric_a, from, to, input.agg_a);
  const b = await dailySeriesForMetric(userId, input.metric_b, from, to, input.agg_b);
  const report = correlationReport(a.map, b.map, lag);

  return {
    metric_a: input.metric_a,
    metric_b: input.metric_b,
    range: { from, to },
    lag_days: lag,
    n: report.n,
    pearson_r: round(report.pearson_r),
    spearman_r: round(report.spearman_r),
    regression: report.regression
      ? {
          slope: round(report.regression.slope, 6),
          intercept: round(report.regression.intercept, 6),
          r2: round(report.regression.r2),
        }
      : null,
    inputs: {
      agg_a: a.agg,
      agg_b: b.agg,
      samples_a: a.n,
      samples_b: b.n,
      paired_after_lag: report.n,
    },
    note: "pearson_r/spearman_r are correlation coefficients and regression is an ordinary-least-squares fit of metric_b on metric_a. Descriptive statistics over the chosen window — not causation, not a recommendation. Interpretation belongs to you or a recipe, not to BI.",
  };
}
