import { describe, expect, it } from "vitest";
import {
  CANONICAL_WORKOUT_TYPES,
  WORKOUT_TYPE_ALIASES,
  normalizeWorkoutType,
} from "./shared";

describe("normalizeWorkoutType", () => {
  it("maps the aliases observed in production data", () => {
    expect(normalizeWorkoutType("running")).toBe("run");
    expect(normalizeWorkoutType("road_biking")).toBe("ride");
    expect(normalizeWorkoutType("road_cycling")).toBe("ride");
    expect(normalizeWorkoutType("Road Cycling")).toBe("ride");
    expect(normalizeWorkoutType("road cycling")).toBe("ride");
    expect(normalizeWorkoutType("lift")).toBe("strength");
    expect(normalizeWorkoutType("WeightTraining")).toBe("strength");
    expect(normalizeWorkoutType("nordic_ski")).toBe("xc_ski");
    expect(normalizeWorkoutType("trail_running")).toBe("trail_run");
  });

  it("keeps canonical types unchanged", () => {
    for (const t of CANONICAL_WORKOUT_TYPES) {
      expect(normalizeWorkoutType(t)).toBe(t);
    }
  });

  it("passes unknown types through lowercased and snake_cased", () => {
    expect(normalizeWorkoutType("Stand Up Paddleboarding")).toBe(
      "stand_up_paddleboarding",
    );
    expect(normalizeWorkoutType("  Bouldering ")).toBe("bouldering");
  });

  it("every alias resolves to a canonical type", () => {
    const canonical = new Set<string>(CANONICAL_WORKOUT_TYPES);
    for (const target of Object.values(WORKOUT_TYPE_ALIASES)) {
      expect(canonical.has(target)).toBe(true);
    }
  });
});
