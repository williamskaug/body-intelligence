import { describe, expect, it } from "vitest";
import { analyzeSliceNeeds, ROUTE_SLICES } from "./page-data";

describe("route-scoped loaders", () => {
  it("does not pull the workout snapshot on Health, Body, Memory, Agents, or Settings", () => {
    const workoutSlices = new Set(["workouts", "metrics", "zones"]);
    for (const route of ["health", "body", "memory", "agents", "settings"] as const) {
      expect(ROUTE_SLICES[route].some((s) => workoutSlices.has(s))).toBe(false);
    }
  });

  it("keeps Train on workouts + zones + derived gates, not daily/events/docs", () => {
    expect(ROUTE_SLICES.train).toEqual(["workouts", "metrics", "zones", "derived"]);
    expect(ROUTE_SLICES.today).toContain("load-balance");
    expect(ROUTE_SLICES.today).not.toContain("zones");
  });

  it("scopes Analyze extras so Build does not wait on the correlation matrix", () => {
    expect(ROUTE_SLICES["analyze:build"]).toEqual([
      "workouts",
      "metrics",
      "load-balance",
      "docs:insight",
    ]);
    expect(ROUTE_SLICES["analyze:stats"]).toContain("matrix");
    expect(ROUTE_SLICES["analyze:build"]).not.toContain("matrix");
    expect(analyzeSliceNeeds("build")).toMatchObject({
      workouts: true,
      metrics: true,
      zones: false,
      daily: false,
      capacity: false,
    });
    expect(analyzeSliceNeeds("stats")).toMatchObject({
      workouts: false,
      daily: true,
    });
  });
});
