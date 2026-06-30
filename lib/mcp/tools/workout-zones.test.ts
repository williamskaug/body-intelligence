import { describe, expect, it } from "vitest";
import { workoutZonesSchema } from "./workout-zones";

describe("workoutZonesSchema", () => {
  it("accepts HR + power zone seconds", () => {
    const r = workoutZonesSchema.safeParse({
      hr_z1_s: 300,
      hr_z2_s: 1800,
      hr_z5_s: 120,
      power_z7_s: 60,
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative seconds", () => {
    expect(workoutZonesSchema.safeParse({ hr_z4_s: -10 }).success).toBe(false);
  });
});
