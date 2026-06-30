import { describe, expect, it } from "vitest";
import { collapseDaily, defaultDailyAgg, impulseForWorkout } from "./metric-series";

describe("defaultDailyAgg", () => {
  it("sums accumulating quantities", () => {
    expect(defaultDailyAgg("workout_duration_min")).toBe("sum");
    expect(defaultDailyAgg("workout_vendor_training_load")).toBe("sum");
    expect(defaultDailyAgg("workout_hr_z4_s")).toBe("sum");
  });
  it("takes max for a daily peak", () => {
    expect(defaultDailyAgg("workout_max_hr")).toBe("max");
  });
  it("averages everything else", () => {
    expect(defaultDailyAgg("workout_avg_hr")).toBe("mean");
    expect(defaultDailyAgg("workout_cadence_spm")).toBe("mean");
  });
});

describe("collapseDaily", () => {
  it("applies the chosen aggregation", () => {
    expect(collapseDaily([10, 20, 30], "sum")).toBe(60);
    expect(collapseDaily([10, 20, 30], "max")).toBe(30);
    expect(collapseDaily([10, 20, 30], "mean")).toBe(20);
  });
});

describe("impulseForWorkout", () => {
  it("prefers vendor load when present and positive", () => {
    expect(
      impulseForWorkout({ duration_min: 60, rpe: 5, vendor_training_load: 180 }),
    ).toBe(180);
  });
  it("falls back to duration × rpe when vendor load is absent", () => {
    expect(
      impulseForWorkout({ duration_min: 60, rpe: 6, vendor_training_load: null }),
    ).toBe(360);
  });
  it("defaults rpe to 5 when missing", () => {
    expect(
      impulseForWorkout({ duration_min: 40, rpe: null, vendor_training_load: null }),
    ).toBe(200);
  });
  it("treats vendor load of 0 as absent", () => {
    expect(
      impulseForWorkout({ duration_min: 30, rpe: 4, vendor_training_load: 0 }),
    ).toBe(120);
  });
});
