import { describe, expect, it } from "vitest";
import { parseWeekPlan } from "./parse-week";

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
  });
});
