import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { computeBaseline } from "@/lib/data-display/baseline";
import { resolveMetric, METRIC_KEYS } from "./metrics";

export const getBaselineInputSchema = {
  metric: z
    .enum(METRIC_KEYS)
    .describe(
      "Which metric to baseline. Daily-entry columns use their snake_case names (e.g. 'rhr_bpm', 'hrv_ms', 'sleep_h', 'skin_temp_deviation_c', 'sleep_score'). Workout-side metrics are prefixed 'workout_' (incl. sensor metrics like 'workout_cadence_spm', 'workout_gct_balance_pct_left'). Agent-derived columns are prefixed 'derived_' (e.g. 'derived_hrv_z', 'derived_sleep_debt_7d_min').",
    ),
  window_days: z
    .number()
    .int()
    .min(3)
    .max(365)
    .describe(
      "Trailing window size in days, ending today (server clock). 30 is the typical choice for personal-baseline comparisons.",
    ),
};

export type GetBaselineInput = {
  metric: (typeof METRIC_KEYS)[number];
  window_days: number;
};

export async function getBaseline(userId: string, input: GetBaselineInput) {
  const { table, column } = resolveMetric(input.metric);
  const sb = adminClient();

  const to = new Date();
  const toDate = to.toISOString().slice(0, 10);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - input.window_days);
  const fromDate = from.toISOString().slice(0, 10);

  const dateColumn = table === "workouts" ? "date" : "date";
  const { data, error } = await sb
    .from(table)
    .select(column)
    .eq("user_id", userId)
    .gte(dateColumn, fromDate)
    .lte(dateColumn, toDate);
  if (error) throw new Error(`get_baseline ${input.metric}: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const values: Array<number | null> = rows.map((row) => {
    const v = row[column];
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

  const baseline = computeBaseline(values);
  return {
    metric: input.metric,
    window_days: input.window_days,
    computed_over: { from: fromDate, to: toDate },
    n: baseline?.count ?? values.filter((v) => v != null).length,
    mean: baseline?.mean ?? null,
    median: baseline?.median ?? null,
    stdev: baseline?.sd ?? null,
  };
}
