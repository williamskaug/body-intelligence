import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";
import { resolveMetric, METRIC_KEYS } from "./metrics";

const AGG_KEYS = ["mean", "median", "min", "max", "stdev", "sum", "count"] as const;

export const getStatsInputSchema = {
  metric: z.enum(METRIC_KEYS),
  from_date: dateString,
  to_date: dateString,
  agg: z.enum(AGG_KEYS).default("mean"),
};

export type GetStatsInput = {
  metric: (typeof METRIC_KEYS)[number];
  from_date: string;
  to_date: string;
  agg?: (typeof AGG_KEYS)[number];
};

export async function getStats(userId: string, input: GetStatsInput) {
  const { table, column } = resolveMetric(input.metric);
  const agg = input.agg ?? "mean";
  const sb = adminClient();

  const { data, error } = await sb
    .from(table)
    .select(column)
    .eq("user_id", userId)
    .gte("date", input.from_date)
    .lte("date", input.to_date);
  if (error) throw new Error(`get_stats ${input.metric}: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const xs: number[] = [];
  for (const row of rows) {
    const v = row[column];
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) xs.push(n);
  }

  const n = xs.length;
  let value: number | null = null;
  if (n === 0 && agg !== "count") {
    value = null;
  } else if (agg === "count") {
    value = n;
  } else if (agg === "sum") {
    value = xs.reduce((a, b) => a + b, 0);
  } else if (agg === "mean") {
    value = xs.reduce((a, b) => a + b, 0) / n;
  } else if (agg === "min") {
    value = Math.min(...xs);
  } else if (agg === "max") {
    value = Math.max(...xs);
  } else if (agg === "median") {
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    value =
      sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  } else if (agg === "stdev") {
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const variance = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
    value = Math.sqrt(variance);
  }

  return {
    metric: input.metric,
    agg,
    from_date: input.from_date,
    to_date: input.to_date,
    n,
    value,
  };
}
