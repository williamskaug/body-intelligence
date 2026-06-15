import { describe, expect, it } from "vitest";
import { computeSourceStatus, sourceDef } from "./source-registry";

const NOW = Date.parse("2026-06-15T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("computeSourceStatus", () => {
  it("manual is never a connector status", () => {
    expect(computeSourceStatus(sourceDef("manual"), daysAgo(60), false, NOW)).toBe(
      "manual",
    );
  });

  it("retired sources read as retired, not down", () => {
    expect(
      computeSourceStatus(sourceDef("garmin_golf"), daysAgo(40), false, NOW),
    ).toBe("retired");
  });

  it("fallback sources go idle when quiet, never down", () => {
    expect(computeSourceStatus(sourceDef("strava"), daysAgo(40), false, NOW)).toBe(
      "idle",
    );
    expect(computeSourceStatus(sourceDef("strava"), daysAgo(2), false, NOW)).toBe(
      "fresh",
    );
  });

  it("primary source is fresh on a rest day when its recipe ran today", () => {
    // No write for 3 days, but the heartbeat fired today.
    expect(computeSourceStatus(sourceDef("garmin"), daysAgo(3), true, NOW)).toBe(
      "fresh",
    );
  });

  it("primary source degrades stale then down when overdue and no heartbeat", () => {
    expect(computeSourceStatus(sourceDef("garmin"), daysAgo(0.5), false, NOW)).toBe(
      "fresh",
    );
    expect(computeSourceStatus(sourceDef("garmin"), daysAgo(1.5), false, NOW)).toBe(
      "stale",
    );
    expect(computeSourceStatus(sourceDef("garmin"), daysAgo(5), false, NOW)).toBe(
      "down",
    );
  });

  it("unknown sources are neutral — never red", () => {
    expect(computeSourceStatus(sourceDef("whatever"), daysAgo(40), false, NOW)).toBe(
      "idle",
    );
  });
});
