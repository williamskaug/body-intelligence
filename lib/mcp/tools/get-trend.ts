import { z } from "zod";
import { linregress } from "@/lib/data-display/statistics";
import { dailySeriesForMetric, type DailyAgg } from "@/lib/data-display/metric-series";
import { dateString } from "./shared";
import { METRIC_KEYS } from "./metrics";
import { dayIndex, resolveRange, round } from "./stats-shared";

export const getTrendInputSchema = {
  metric: z.enum(METRIC_KEYS),
  window_days: z.number().int().min(3).max(365).default(30),
  from_date: dateString.optional(),
  to_date: dateString.optional(),
  agg: z.enum(["sum", "mean", "max"]).optional(),
};

export type GetTrendInput = {
  metric: (typeof METRIC_KEYS)[number];
  window_days?: number;
  from_date?: string;
  to_date?: string;
  agg?: DailyAgg;
};

export async function getTrend(userId: string, input: GetTrendInput) {
  const { from, to } = resolveRange(input);
  const { map, agg } = await dailySeriesForMetric(userId, input.metric, from, to, input.agg);

  // OLS over (day index from `from`, value). Null days are skipped, never
  // imputed — dayIndex preserves the real spacing between observations.
  const dates = Array.from(map.keys()).sort();
  const xs: number[] = [];
  const ys: number[] = [];
  for (const d of dates) {
    xs.push(dayIndex(from, d));
    ys.push(map.get(d)!);
  }
  const reg = linregress(xs, ys);
  const direction =
    reg == null ? null : reg.slope > 0 ? "rising" : reg.slope < 0 ? "falling" : "flat";

  return {
    metric: input.metric,
    range: { from, to },
    agg_used: agg,
    n: dates.length,
    first_date: dates[0] ?? null,
    last_date: dates[dates.length - 1] ?? null,
    slope_per_day: round(reg?.slope ?? null, 6),
    slope_per_week: round(reg ? reg.slope * 7 : null, 6),
    slope_per_30d: round(reg ? reg.slope * 30 : null, 6),
    intercept: round(reg?.intercept ?? null, 6),
    r2: round(reg?.r2 ?? null),
    direction,
    note: "Ordinary-least-squares trend line over day index. 'direction' is the sign of the slope (rising/flat/falling) — a description of the number, not an improving/declining judgment, and there is no magnitude threshold.",
  };
}
