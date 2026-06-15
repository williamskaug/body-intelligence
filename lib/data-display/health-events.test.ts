import { describe, expect, it } from "vitest";
import {
  eventThread,
  splitLegacyStatusNotes,
  type ThreadedHealthEvent,
} from "./health-events";

const BLOB = `Lower-leg and hip/thigh overload after a high-volume block. INITIAL SYMPTOMS: mild outer-knee stiffness.
STATUS MAY 25: Last 15 days pain-free, return-to-run test planned.
STATUS JUNE 2 (corrected via user): June 1 auto-resolution premature; MRI scheduled ~2026-06-23.
STATUS JUNE 8: RED illness composite triggered. New illness event opened.`;

describe("splitLegacyStatusNotes", () => {
  it("splits a STATUS-appended notes blob into summary + updates", () => {
    const split = splitLegacyStatusNotes(BLOB);
    expect(split).not.toBeNull();
    expect(split!.summary).toContain("Lower-leg and hip/thigh overload");
    expect(split!.summary).not.toContain("STATUS");
    expect(split!.updates).toHaveLength(3);
    expect(split!.updates[0]!.label).toBe("MAY 25");
    expect(split!.updates[2]!.label).toBe("JUNE 8");
  });

  it("returns null for plain notes with no STATUS markers", () => {
    expect(splitLegacyStatusNotes("Just a normal injury note, nothing dated.")).toBeNull();
  });
});

describe("eventThread", () => {
  const base: Omit<ThreadedHealthEvent, "updates" | "notes"> = {
    id: "e1",
    date: "2026-04-27",
    kind: "injury",
    body_part: "left hip/thigh",
    severity: 2,
    resolved_date: null,
    next_milestone: "MRI",
    next_milestone_date: "2026-06-23",
  };

  it("prefers real update rows over the legacy notes blob", () => {
    const t = eventThread({
      ...base,
      notes: "summary text",
      updates: [
        { date: "2026-06-01", note: "first", severity_at_time: 2 },
        { date: "2026-06-10", note: "second", severity_at_time: 3 },
      ],
    });
    expect(t.summary).toBe("summary text");
    // newest first
    expect(t.updates[0]!.label).toBe("2026-06-10");
    expect(t.updates[1]!.label).toBe("2026-06-01");
  });

  it("falls back to splitting the legacy blob when no update rows exist", () => {
    const t = eventThread({ ...base, notes: BLOB, updates: [] });
    expect(t.summary).toContain("Lower-leg");
    expect(t.updates.length).toBe(3);
    // newest first after reverse
    expect(t.updates[0]!.label).toBe("JUNE 8");
  });
});
