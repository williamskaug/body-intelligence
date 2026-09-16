import { describe, expect, it } from "vitest";
import { fetchSpan, parseWindow, windowQuery } from "./window";

describe("window", () => {
  it("defaults to 90D and treats nogolf=1 as RUN FOCUS", () => {
    expect(parseWindow({})).toEqual({ days: 90, focusRun: false });
    expect(parseWindow({ days: "7", focus: "run" })).toEqual({ days: 7, focusRun: true });
    expect(parseWindow({ nogolf: "1" })).toEqual({ days: 90, focusRun: true });
  });

  it("serializes chips without empty extras", () => {
    expect(windowQuery({ days: 90, focusRun: false })).toBe("?days=90");
    expect(windowQuery({ days: 30, focusRun: true }, { tab: "fitness" })).toBe(
      "?days=30&focus=run&tab=fitness",
    );
  });

  it("shares a 120-day fetch across 7/30/90 so chip changes do not refetch", () => {
    expect(fetchSpan(7)).toBe(120);
    expect(fetchSpan(30)).toBe(120);
    expect(fetchSpan(90)).toBe(120);
    expect(fetchSpan(365)).toBe(365);
  });
});
