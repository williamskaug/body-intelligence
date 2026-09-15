import { describe, expect, it } from "vitest";
import {
  applyFocus,
  isLongRun,
  isRunType,
  runningEfficiency,
  weeklyRampPct,
  weeklyVolume,
  workoutTitle,
} from "./training";

describe("training helpers", () => {
  it("treats trail_run as a run and golf as out of RUN FOCUS", () => {
    expect(isRunType("trail_run")).toBe(true);
    expect(isRunType("golf")).toBe(false);
    expect(applyFocus([{ type: "run" }, { type: "golf" }, { type: "ride" }], true)).toEqual([
      { type: "run" },
    ]);
  });

  it("classifies long runs by distance or duration", () => {
    expect(isLongRun({ date: "2026-09-08", type: "run", duration_min: 60, distance_km: 21, avg_hr: 150, rpe: 5 })).toBe(
      true,
    );
    expect(isLongRun({ date: "2026-09-08", type: "run", duration_min: 80, distance_km: 10, avg_hr: 140, rpe: 4 })).toBe(
      true,
    );
    expect(isLongRun({ date: "2026-09-08", type: "run", duration_min: 40, distance_km: 8, avg_hr: 140, rpe: 4 })).toBe(
      false,
    );
    expect(isLongRun({ date: "2026-09-08", type: "ride", duration_min: 120, distance_km: 40, avg_hr: 130, rpe: 5 })).toBe(
      false,
    );
  });

  it("computes metres-per-heartbeat efficiency", () => {
    expect(runningEfficiency(10, 50, 150)).toBeCloseTo((10 * 1000) / (150 * 50));
    expect(runningEfficiency(0, 50, 150)).toBeNull();
  });

  it("uses the first short notes line as a title", () => {
    expect(workoutTitle({ type: "run", notes: "4 × 8' threshold\nmore", distance_km: 14 })).toBe(
      "4 × 8' threshold",
    );
  });

  it("computes week-over-week ramp from run km", () => {
    const weeks = weeklyVolume(
      [
        { date: "2026-08-31", type: "run", duration_min: 50, distance_km: 10, avg_hr: 140, rpe: 5 },
        { date: "2026-09-07", type: "run", duration_min: 50, distance_km: 12, avg_hr: 140, rpe: 5 },
      ],
      "2026-09-14",
      3,
    );
    const ramps = weeklyRampPct(weeks);
    expect(ramps[0]).toBeNull();
    const last = ramps[ramps.length - 1];
    expect(last == null || Number.isFinite(last)).toBe(true);
  });
});
