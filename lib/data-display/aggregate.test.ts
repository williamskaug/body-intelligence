import { describe, expect, it } from "vitest";
import { hoursByType } from "./aggregate";

describe("hoursByType", () => {
  const workouts = [
    { type: "run", duration_min: 60 },
    { type: "run", duration_min: 30 },
    { type: "ride", duration_min: 120 },
    { type: "golf", duration_min: 240 },
    { type: "walk", duration_min: 45 },
    { type: "yoga", duration_min: null },
    { type: "mobility", duration_min: 0 },
  ];

  it("sums hours by type and ignores non-positive durations", () => {
    const { entries, totalHours } = hoursByType(workouts, 3);
    // 60+30+120+240+45 = 495 min = 8.25h (yoga null + mobility 0 skipped)
    expect(totalHours).toBeCloseTo(8.25, 5);
    expect(entries[0]).toEqual({ type: "golf", hours: 4 });
  });

  it("buckets excluded types separately without inflating training hours", () => {
    const excluded = new Set(["golf", "walk", "mobility", "yoga"]);
    const { entries, totalHours, excludedEntries, excludedHours } = hoursByType(
      workouts,
      3,
      excluded,
    );
    // Endurance only: run 90 + ride 120 = 210 min = 3.5h
    expect(totalHours).toBeCloseTo(3.5, 5);
    expect(entries.map((e) => e.type)).toEqual(["ride", "run"]);
    // Excluded: golf 240 + walk 45 = 285 min = 4.75h (yoga/mobility non-positive)
    expect(excludedHours).toBeCloseTo(4.75, 5);
    expect(excludedEntries[0]).toEqual({ type: "golf", hours: 4 });
  });

  it("reports zero excluded hours when no exclusion set is passed", () => {
    const { excludedEntries, excludedHours } = hoursByType(workouts, 3);
    expect(excludedHours).toBe(0);
    expect(excludedEntries).toEqual([]);
  });
});
