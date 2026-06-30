import { z } from "zod";
import { alignByDate, pearson, spearman } from "@/lib/data-display/statistics";
import { dailySeriesForMetric } from "@/lib/data-display/metric-series";
import { dateString } from "./shared";
import { METRIC_KEYS } from "./metrics";
import { resolveRange, round } from "./stats-shared";

export const getCorrelationMatrixInputSchema = {
  metrics: z
    .array(z.enum(METRIC_KEYS))
    .min(2)
    .max(8)
    .describe("2–8 metric keys. Capped at 8 (≤28 unique pairs) to keep the heatmap legible."),
  window_days: z.number().int().min(3).max(365).default(90),
  from_date: dateString.optional(),
  to_date: dateString.optional(),
  lag_days: z.number().int().min(-30).max(30).default(0),
  method: z.enum(["pearson", "spearman"]).default("pearson"),
};

export type GetCorrelationMatrixInput = {
  metrics: Array<(typeof METRIC_KEYS)[number]>;
  window_days?: number;
  from_date?: string;
  to_date?: string;
  lag_days?: number;
  method?: "pearson" | "spearman";
};

export async function getCorrelationMatrix(userId: string, input: GetCorrelationMatrixInput) {
  const { from, to } = resolveRange(input);
  const lag = input.lag_days ?? 0;
  const method = input.method ?? "pearson";
  const corr = method === "spearman" ? spearman : pearson;
  const metrics = input.metrics;

  // Fetch each metric's daily series once.
  const series: Array<Map<string, number>> = [];
  for (const m of metrics) {
    series.push((await dailySeriesForMetric(userId, m, from, to)).map);
  }

  const matrix: Array<Array<number | null>> = [];
  const nMatrix: number[][] = [];
  for (let i = 0; i < metrics.length; i++) {
    const rowR: Array<number | null> = [];
    const rowN: number[] = [];
    for (let j = 0; j < metrics.length; j++) {
      const { xs, ys } = alignByDate(series[i]!, series[j]!, lag);
      rowN.push(xs.length);
      if (i === j && lag === 0) {
        rowR.push(xs.length >= 3 ? 1 : null);
      } else {
        rowR.push(round(corr(xs, ys)));
      }
    }
    matrix.push(rowR);
    nMatrix.push(rowN);
  }

  return {
    metrics,
    range: { from, to },
    lag_days: lag,
    method,
    matrix,
    n_matrix: nMatrix,
    note: "Pairwise correlation coefficients for a heatmap. lag_days=0 ⇒ symmetric; lag≠0 ⇒ directional (cell [i][j] = metric i lagged vs metric j). Cells with n<3 are null. Descriptive only — no driver ranking, no verdict.",
  };
}
