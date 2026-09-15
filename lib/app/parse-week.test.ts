import { describe, expect, it } from "vitest";
import { blockLabel, parseWeekPlan } from "./parse-week";

describe("parseWeekPlan", () => {
  it("reads weekday rows from CURRENT.md This week", () => {
    const md = `# Current
## This week
- Mon ride: 90' Z2
- Tue run: 4×8' threshold · done
- Wed STR: single-leg
## Active block
Base 2 · wk 3/4
`;
    const parsed = parseWeekPlan(md);
    expect(parsed.items.map((i) => i.dow)).toEqual(["Mon", "Tue", "Wed"]);
    expect(parsed.items[0]?.type).toBe("ride");
    expect(parsed.items[1]?.done).toBe(true);
    expect(parsed.items[2]?.type).toBe("strength");
    expect(parsed.block).toMatch(/Base 2/);
    expect(parsed.blockLabel).toBe("Base 2 · wk 3/4");
  });
});

describe("blockLabel", () => {
  it("keeps a short mock-style block line as-is", () => {
    expect(blockLabel("Base 2 · wk 3/4")).toBe("Base 2 · wk 3/4");
  });

  it("compresses a Phase 0 essay into a chip, not the document body", () => {
    const essay = `**Phase 0 — Structure & consistency (Sep 14 – Oct 11 2026), week 1 of 4.** The re-scope is resolved: the A-race is Oslo Marathon 2027-09-18, goal sub-3:00, and the 53-week periodised build lives in \`plans/oslo-marathon-2027.md\` (rev. 3, run-first — read it before every re-plan). The diagnosis that shapes the year: Garmin speed markers are already ~sub-3-equivalent (VO2max 59.6, LT 4:07/km, 5K-predict 18:46); the gap is **endurance/durability and run-specific tissue tolerance**, so the whole first phase is easy aerobic volume with zero quality — no threshold/intervals until January.`;
    expect(blockLabel(essay)).toBe("Phase 0 · wk 1/4");
  });

  it("truncates a long first line at a word boundary instead of mid-word", () => {
    const source =
      "Rebuilding aerobic volume after the summer break with lots of easy riding and no quality sessions planned until the next block starts";
    const label = blockLabel(source);
    expect(label).not.toBeNull();
    expect(label!.length).toBeLessThanOrEqual(42);
    expect(label!.endsWith("…")).toBe(true);
    const stem = label!.slice(0, -1);
    expect(source.startsWith(stem)).toBe(true);
    const next = source[stem.length];
    expect(next === undefined || /\s/.test(next)).toBe(true);
  });

  it("returns null for empty / comment-only sections", () => {
    expect(blockLabel("")).toBeNull();
    expect(blockLabel("   \n  ")).toBeNull();
  });
});
