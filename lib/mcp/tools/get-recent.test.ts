import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getRecentInputSchema } from "./get-recent";
import { getStreakInputSchema } from "./get-streak";

describe("meal-related MCP args", () => {
  it("get_recent no longer accepts meals as a kind", () => {
    const schema = z.object(getRecentInputSchema);
    expect(schema.safeParse({ days: 7, kinds: ["meals"] }).success).toBe(false);
    expect(
      schema.safeParse({ days: 7, kinds: ["workouts", "daily", "health_events"] }).success,
    ).toBe(true);
  });

  it("get_streak no longer accepts meal_logged", () => {
    const schema = z.object(getStreakInputSchema);
    expect(schema.safeParse({ kind: "meal_logged" }).success).toBe(false);
    expect(schema.safeParse({ kind: "workout" }).success).toBe(true);
    expect(schema.safeParse({ kind: "daily_entry" }).success).toBe(true);
  });
});
