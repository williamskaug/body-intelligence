import { describe, expect, it } from "vitest";
import { z } from "zod";
import { logDailyInputSchema } from "./log-daily";

const schema = z.object(logDailyInputSchema);

describe("logDailyInputSchema", () => {
  it("accepts the capture fields", () => {
    const r = schema.safeParse({
      date: "2026-06-30",
      stress_score: 32,
      body_battery_morning: 56,
      training_readiness_score: 64,
      training_status: "productive",
      sleep_score: 80,
      weight_kg: 74.2,
    });
    expect(r.success).toBe(true);
  });

  it("rejects out-of-range values", () => {
    expect(schema.safeParse({ date: "2026-06-30", stress_score: 150 }).success).toBe(false);
    expect(schema.safeParse({ date: "2026-06-30", sleep_score: 120 }).success).toBe(false);
    expect(schema.safeParse({ date: "2026-06-30", rhr_bpm: 10 }).success).toBe(false);
  });

  it("rejects dropped columns", () => {
    const r = schema.safeParse({ date: "2026-06-30", body_fat_pct: 12, fatigue: 3 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).not.toHaveProperty("body_fat_pct");
      expect(r.data).not.toHaveProperty("fatigue");
    }
  });
});
