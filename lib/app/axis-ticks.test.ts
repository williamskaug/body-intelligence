import { describe, expect, it } from "vitest";
import { shouldShowAxisLabel } from "./axis-ticks";

describe("shouldShowAxisLabel", () => {
  it("shows every label when the series is short", () => {
    expect([0, 1, 2, 3].filter((i) => shouldShowAxisLabel(i, 4))).toEqual([0, 1, 2, 3]);
  });

  it("keeps ends and the current bar, skipping neighbors of current", () => {
    const n = 16;
    const current = 15;
    const shown = Array.from({ length: n }, (_, i) => i).filter((i) =>
      shouldShowAxisLabel(i, n, current),
    );
    expect(shown[0]).toBe(0);
    expect(shown.at(-1)).toBe(15);
    expect(shown).not.toContain(14);
    expect(shown.length).toBeLessThan(n);
  });
});
