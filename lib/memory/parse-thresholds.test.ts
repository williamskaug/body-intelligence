import { describe, expect, it } from "vitest";
import { parseThresholds } from "./parse-thresholds";

const FILLED = `# Training thresholds & zones

## Run thresholds
- LTHR: 168
- Threshold pace: 4:00/km
- Updated: 2026-06-30

## Run HR zones
- Z1: 110-140 bpm
- Z2: 140-155 bpm
- Z3: 155-165 bpm
- Z4: 165-172 bpm
- Z5: 172-185 bpm

## Bike thresholds
- FTP: 280
- Updated: 2026-06-30

## Bike power zones
- Z1: 0-150 W
- Z2: 150-205 W
`;

describe("parseThresholds", () => {
  it("parses run + bike thresholds and zones", () => {
    const t = parseThresholds(FILLED);
    expect(t.run.lthr).toBe(168);
    expect(t.run.thresholdPace).toBe("4:00/km");
    expect(t.run.updated).toBe("2026-06-30");
    expect(t.run.zones).toHaveLength(5);
    expect(t.run.zones[0]).toEqual({ zone: 1, lo: 110, hi: 140 });
    expect(t.run.zones[4]).toEqual({ zone: 5, lo: 172, hi: 185 });
    expect(t.bike.ftp).toBe(280);
    expect(t.bike.zones).toHaveLength(2);
  });

  it("returns an empty structure for empty input and the unfilled template", () => {
    const empty = parseThresholds("");
    expect(empty.run.lthr).toBeNull();
    expect(empty.run.zones).toEqual([]);
    expect(empty.bike.ftp).toBeNull();

    // Template shape with no values filled in → nothing parses.
    const unfilled = parseThresholds(`## Run thresholds\n- LTHR:\n- Threshold pace:\n\n## Run HR zones\n- Z1:\n- Z2:\n`);
    expect(unfilled.run.lthr).toBeNull();
    expect(unfilled.run.zones).toEqual([]);
  });
});
