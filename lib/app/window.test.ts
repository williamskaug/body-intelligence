import { describe, expect, it } from "vitest";
import { parseWindow, windowQuery } from "./window";

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
});
