import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getCorrelationInputSchema } from "./get-correlation";
import { getCorrelationMatrixInputSchema } from "./get-correlation-matrix";
import { getDistributionInputSchema } from "./get-distribution";
import { getLoadBalanceInputSchema } from "./get-load-balance";

describe("stats-engine input validation", () => {
  it("get_correlation rejects an unknown metric and an out-of-range lag", () => {
    const schema = z.object(getCorrelationInputSchema);
    expect(
      schema.safeParse({ metric_a: "hrv_ms", metric_b: "not_a_metric" }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ metric_a: "hrv_ms", metric_b: "rhr_bpm", lag_days: 99 }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ metric_a: "hrv_ms", metric_b: "rhr_bpm", lag_days: 1 }).success,
    ).toBe(true);
  });

  it("get_correlation_matrix rejects <2 and >8 metrics", () => {
    const schema = z.object(getCorrelationMatrixInputSchema);
    expect(schema.safeParse({ metrics: ["hrv_ms"] }).success).toBe(false);
    expect(
      schema.safeParse({
        metrics: [
          "hrv_ms",
          "rhr_bpm",
          "sleep_h",
          "weight_kg",
          "steps",
          "stress_score",
          "body_fat_pct",
          "spo2_avg_pct",
          "mood",
        ],
      }).success,
    ).toBe(false);
  });

  it("get_distribution rejects bins below 2", () => {
    const schema = z.object(getDistributionInputSchema);
    expect(schema.safeParse({ metric: "rhr_bpm", bins: 1 }).success).toBe(false);
    expect(schema.safeParse({ metric: "rhr_bpm", bins: 10 }).success).toBe(true);
  });

  it("get_load_balance rejects a window shorter than 14 days", () => {
    const schema = z.object(getLoadBalanceInputSchema);
    expect(schema.safeParse({ days: 5 }).success).toBe(false);
    expect(schema.safeParse({ days: 90 }).success).toBe(true);
  });
});
