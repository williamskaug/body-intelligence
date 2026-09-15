import { describe, expect, it } from "vitest";
import { recipes } from "./recipe-data";

const KEPT_IDS = [
  "backfill",
  "capacity-sync",
  "dawn-agent",
  "garmin-sync",
  "health-log-audit",
  "insights",
  "onboarding",
] as const;

const REMOVED_IDS = [
  "morning-checkin",
  "evening-reflection",
  "weekly-review",
  "race-countdown",
  "strava-sync",
] as const;

const DROPPED_COLUMN_OR_MEAL_TOOL =
  /\b(log_meal|bulk_log_meals|get_meal|list_meals|update_meal|delete_meal|body_fat_pct|muscle_mass_kg|bone_mass_kg|body_water_pct|hydration_ml|bp_systolic_mmhg|bp_diastolic_mmhg|meal_notes|sleep_quality|soreness)\b/;

describe("solo-user recipe catalog", () => {
  it("keeps only the agreed catalog recipes", () => {
    expect(recipes.map((r) => r.id).sort()).toEqual([...KEPT_IDS].sort());
  });

  it("does not include the pruned recipes", () => {
    const ids = new Set(recipes.map((r) => r.id));
    for (const id of REMOVED_IDS) {
      expect(ids.has(id)).toBe(false);
    }
  });

  it("kept prompts do not mention meal tools or dropped daily columns", () => {
    for (const recipe of recipes) {
      expect(recipe.prompt, recipe.id).not.toMatch(DROPPED_COLUMN_OR_MEAL_TOOL);
      expect(recipe.required_tools.join(" "), recipe.id).not.toMatch(
        /log_meal|bulk_log_meals|get_meal|list_meals|update_meal|delete_meal/,
      );
      for (const removed of REMOVED_IDS) {
        expect(recipe.prompt, `${recipe.id} mentions ${removed}`).not.toContain(removed);
      }
    }
  });
});
