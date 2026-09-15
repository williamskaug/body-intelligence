import { describe, expect, it } from "vitest";
import { getRecipe, recipes } from "./recipe-data";

const KEPT = [
  "dawn-agent",
  "onboarding",
  "garmin-sync",
  "capacity-sync",
  "backfill",
  "health-log-audit",
  "insights",
] as const;

const REMOVED = [
  "morning-checkin",
  "evening-reflection",
  "weekly-review",
  "race-countdown",
  "strava-sync",
] as const;

describe("recipe catalog", () => {
  it("keeps exactly the seven solo-user recipes", () => {
    expect(recipes.map((r) => r.id).sort()).toEqual([...KEPT].sort());
  });

  it("does not resurrect the pruned catalog ids", () => {
    for (const id of REMOVED) {
      expect(getRecipe(id)).toBeUndefined();
    }
  });

  it("does not mention dropped meal tools or daily columns in prompts", () => {
    const banned =
      /\blog_meal\b|\bmeal_notes\b|\bbody_fat_pct\b|\bfatigue\b|\bsoreness\b|\bsleep_quality\b/;
    for (const r of recipes) {
      expect(r.prompt, r.id).not.toMatch(banned);
    }
  });
});
