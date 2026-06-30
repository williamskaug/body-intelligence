import { describe, expect, it } from "vitest";
import {
  CAPACITY_METRICS,
  DAILY_METRICS,
  DERIVED_METRICS,
  METRIC_KEYS,
  resolveMetric,
  WORKOUT_METRICS,
  WORKOUT_SENSOR_METRICS,
  WORKOUT_ZONE_METRICS,
} from "./metrics";

describe("resolveMetric", () => {
  it("routes each metric class to the right table and strips the prefix", () => {
    expect(resolveMetric("stress_score")).toEqual({
      table: "daily_entries",
      column: "stress_score",
    });
    expect(resolveMetric("body_fat_pct")).toEqual({
      table: "daily_entries",
      column: "body_fat_pct",
    });
    expect(resolveMetric("workout_rpe")).toEqual({ table: "workouts", column: "rpe" });
    expect(resolveMetric("workout_cadence_spm")).toEqual({
      table: "workout_metrics",
      column: "cadence_spm",
    });
    expect(resolveMetric("workout_weather_temp_c")).toEqual({
      table: "workout_metrics",
      column: "weather_temp_c",
    });
    // Zone metrics share the "workout_" prefix but must route to workout_zones,
    // not workout_metrics — guards the resolveMetric ordering.
    expect(resolveMetric("workout_hr_z4_s")).toEqual({
      table: "workout_zones",
      column: "hr_z4_s",
    });
    expect(resolveMetric("workout_power_z2_s")).toEqual({
      table: "workout_zones",
      column: "power_z2_s",
    });
    expect(resolveMetric("capacity_vo2max_running")).toEqual({
      table: "capacity_metrics",
      column: "vo2max_running",
    });
    expect(resolveMetric("derived_hrv_z")).toEqual({
      table: "derived_daily",
      column: "hrv_z",
    });
  });

  it("resolves every METRIC_KEY to a non-empty column with no residual prefix", () => {
    for (const key of METRIC_KEYS) {
      const { table, column } = resolveMetric(key);
      expect(column.length).toBeGreaterThan(0);
      expect(column.startsWith("derived_")).toBe(false);
      expect(column.startsWith("capacity_")).toBe(false);
      expect(table).toBeTruthy();
    }
  });

  it("keeps the six metric arrays pairwise disjoint", () => {
    const arrays: Record<string, readonly string[]> = {
      DAILY_METRICS,
      WORKOUT_METRICS,
      WORKOUT_SENSOR_METRICS,
      WORKOUT_ZONE_METRICS,
      CAPACITY_METRICS,
      DERIVED_METRICS,
    };
    const seen = new Set<string>();
    for (const arr of Object.values(arrays)) {
      for (const k of arr) {
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
    // No accidental drops or duplicates in the combined enum.
    expect(seen.size).toBe(METRIC_KEYS.length);
  });
});
