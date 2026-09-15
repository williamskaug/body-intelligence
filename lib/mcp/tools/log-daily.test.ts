import { describe, expect, it } from "vitest";
import { z } from "zod";
import { logDailyInputSchema } from "./log-daily";

const schema = z.object(logDailyInputSchema);

const DROPPED_KEYS = [
  "fatigue",
  "soreness",
  "mood",
  "stress",
  "motivation",
  "sleep_quality",
  "body_fat_pct",
  "muscle_mass_kg",
  "bone_mass_kg",
  "body_water_pct",
  "hydration_ml",
  "bp_systolic_mmhg",
  "bp_diastolic_mmhg",
  "meal_notes",
] as const;

const KEPT_KEYS = [
  "sleep_h",
  "hrv_ms",
  "rhr_bpm",
  "weight_kg",
  "spo2_avg_pct",
  "respiration_avg_brpm",
  "skin_temp_deviation_c",
  "sleep_score",
  "steps",
  "active_calories",
  "floors_climbed",
  "intensity_min_moderate",
  "intensity_min_vigorous",
  "stress_score",
  "body_battery_morning",
  "training_readiness_score",
  "training_status",
  "sleep_notes",
  "wellness_notes",
] as const;

describe("logDailyInputSchema", () => {
  it("accepts kept capture fields", () => {
    const r = schema.safeParse({
      date: "2026-06-30",
      stress_score: 32,
      body_battery_morning: 56,
      training_readiness_score: 64,
      training_status: "productive",
      weight_kg: 78.4,
      sleep_h: 7.2,
      hrv_ms: 45,
    });
    expect(r.success).toBe(true);
  });

  it("rejects out-of-range values on kept fields", () => {
    expect(schema.safeParse({ date: "2026-06-30", stress_score: 150 }).success).toBe(false);
    expect(schema.safeParse({ date: "2026-06-30", sleep_h: 30 }).success).toBe(false);
    expect(schema.safeParse({ date: "2026-06-30", hrv_ms: -1 }).success).toBe(false);
  });

  it("does not accept dropped subjective, body-comp, or meal_notes fields", () => {
    const keys = Object.keys(logDailyInputSchema);
    for (const key of DROPPED_KEYS) {
      expect(keys).not.toContain(key);
    }
    for (const key of KEPT_KEYS) {
      expect(keys).toContain(key);
    }
  });
});
