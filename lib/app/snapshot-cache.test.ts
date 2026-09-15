import { describe, expect, it } from "vitest";
import {
  analyzeExtrasCacheKey,
  dehydrateContentMap,
  hydrateContentMap,
  snapshotCacheKey,
  userDataTag,
} from "./snapshot-cache";

describe("snapshot cache helpers", () => {
  it("scopes tags and keys per user / window so navigations can share a fetch", () => {
    expect(userDataTag("abc")).toBe("bi-user-abc");
    expect(snapshotCacheKey("u1", "a@b.c", 90, false)).toEqual([
      "app-snapshot",
      "u1",
      "a@b.c",
      "90",
      "all",
    ]);
    expect(snapshotCacheKey("u1", "a@b.c", 90, true)).toEqual([
      "app-snapshot",
      "u1",
      "a@b.c",
      "90",
      "run",
    ]);
    expect(analyzeExtrasCacheKey("u1", 90, false)).toEqual(["analyze-extras", "u1", "90", "all"]);
  });

  it("round-trips document content through a JSON-safe record (unstable_cache cannot store Map)", () => {
    const map = new Map([
      ["GOALS.md", "## Race: Oslo"],
      ["CURRENT.md", "Week 37"],
    ]);
    const record = dehydrateContentMap(map);
    expect(record).toEqual({ "GOALS.md": "## Race: Oslo", "CURRENT.md": "Week 37" });
    expect(JSON.parse(JSON.stringify(record))).toEqual(record);
    expect(hydrateContentMap(record).get("CURRENT.md")).toBe("Week 37");
  });
});
