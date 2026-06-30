import { describe, expect, it } from "vitest";
import { z } from "zod";
import { logCapacityInputSchema } from "./log-capacity";

const schema = z.object(logCapacityInputSchema);

describe("logCapacityInputSchema", () => {
  it("accepts a full capacity snapshot", () => {
    const r = schema.safeParse({
      date: "2026-06-30",
      vo2max_running: 56.4,
      lactate_threshold_hr_bpm: 168,
      lactate_threshold_pace_s_per_km: 235,
      cycling_ftp_w: 280,
      endurance_score: 7200,
      hill_score: 62,
      fitness_age_years: 31.5,
      race_pred_marathon_s: 11_400,
    });
    expect(r.success).toBe(true);
  });

  it("rejects out-of-range and non-positive values", () => {
    expect(schema.safeParse({ date: "2026-06-30", vo2max_running: 120 }).success).toBe(false);
    expect(schema.safeParse({ date: "2026-06-30", race_pred_marathon_s: 0 }).success).toBe(false);
    expect(schema.safeParse({ date: "2026-06-30", hill_score: 200 }).success).toBe(false);
  });
});
