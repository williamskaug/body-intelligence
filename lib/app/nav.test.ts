import { describe, expect, it } from "vitest";
import { APP_NAV, sectionFromPath, sectionTitle } from "./nav";

describe("app nav", () => {
  it("lists the mock IA order with settings excluded from the numbered rail", () => {
    expect(APP_NAV.map((i) => i.label)).toEqual([
      "Today",
      "Train",
      "Analyze",
      "Body",
      "Health",
      "Memory",
      "Agents",
    ]);
    expect(sectionFromPath("/analyze?tab=build")).toBe("analyze");
    expect(sectionFromPath("/settings")).toBe("settings");
    expect(sectionTitle("today")).toBe("Today");
  });
});
