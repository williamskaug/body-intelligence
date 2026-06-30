import { describe, expect, it } from "vitest";
import { z } from "zod";
import { logDailyInputSchema } from "./log-daily";

const schema = z.object(logDailyInputSchema);

describe("logDailyInputSchema", () => {
  it("accepts the new capture fields", () => {
    const r = schema.safeParse({
      date: "2026-06-30",
      stress_score: 32,
      body_battery_morning: 56,
      training_readiness_score: 64,
      training_status: "productive",
      muscle_mass_kg: 34.2,
      bone_mass_kg: 3.1,
      body_water_pct: 58.5,
      bp_systolic_mmhg: 118,
      bp_diastolic_mmhg: 74,
      hydration_ml: 2200,
    });
    expect(r.success).toBe(true);
  });

  it("rejects out-of-range values", () => {
    expect(schema.safeParse({ date: "2026-06-30", stress_score: 150 }).success).toBe(false);
    expect(schema.safeParse({ date: "2026-06-30", body_water_pct: 120 }).success).toBe(false);
    expect(schema.safeParse({ date: "2026-06-30", bp_systolic_mmhg: 10 }).success).toBe(false);
  });
});
