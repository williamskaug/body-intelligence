import { describe, expect, it } from "vitest";
import { workoutMetricsSchema } from "./workout-metrics";

describe("workoutMetricsSchema", () => {
  it("accepts the new weather + strength-volume fields", () => {
    const r = workoutMetricsSchema.safeParse({
      cadence_spm: 172,
      weather_temp_c: 21.5,
      weather_humidity_pct: 60,
      strength_volume_kg: 4200,
    });
    expect(r.success).toBe(true);
  });

  it("rejects humidity out of range", () => {
    expect(workoutMetricsSchema.safeParse({ weather_humidity_pct: 150 }).success).toBe(false);
  });
});
