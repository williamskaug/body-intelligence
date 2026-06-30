import { describe, expect, it } from "vitest";
import {
  alignByDate,
  ewma,
  histogram,
  linregress,
  pearson,
  percentile,
  quantiles,
  spearman,
} from "./statistics";

describe("pearson", () => {
  it("is +1 for a perfectly increasing linear pair", () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBeCloseTo(1, 10);
  });
  it("is −1 for a perfectly decreasing pair", () => {
    expect(pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });
  it("matches a hand-computed value (8/sqrt(68))", () => {
    expect(pearson([1, 2, 3, 4, 5], [1, 2, 3, 4, 4])).toBeCloseTo(8 / Math.sqrt(68), 10);
  });
  it("returns null on zero variance and on n<3", () => {
    expect(pearson([1, 2, 3, 4, 5], [5, 5, 5, 5, 5])).toBeNull();
    expect(pearson([1, 2], [2, 4])).toBeNull();
  });
  it("ignores pairs where either side is null", () => {
    expect(pearson([1, 2, null, 4, 5], [2, 4, 100, 8, 10])).toBeCloseTo(1, 10);
  });
});

describe("spearman", () => {
  it("is 1 for a monotonic-but-nonlinear pair where pearson is below 1", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [1, 4, 9, 16, 25];
    expect(spearman(x, y)).toBeCloseTo(1, 10);
    expect(pearson(x, y)!).toBeLessThan(1);
  });
});

describe("linregress", () => {
  it("recovers slope/intercept/r2 for y = 2x + 1", () => {
    const r = linregress([0, 1, 2, 3], [1, 3, 5, 7])!;
    expect(r.slope).toBeCloseTo(2, 10);
    expect(r.intercept).toBeCloseTo(1, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });
  it("returns null when x has zero variance", () => {
    expect(linregress([3, 3, 3, 3], [1, 2, 3, 4])).toBeNull();
  });
});

describe("ewma", () => {
  it("keeps a constant series constant when seeded at its value", () => {
    expect(ewma([10, 10, 10, 10], 7, 10)).toEqual([10, 10, 10, 10]);
  });
  it("uses alpha = 1 - e^(-1/tau)", () => {
    expect(ewma([1], 7, 0)[0]).toBeCloseTo(1 - Math.exp(-1 / 7), 12);
  });
});

describe("percentile / quantiles", () => {
  it("interpolates type-7 percentiles", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBeCloseTo(2.5, 10);
    const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(hundred, 95)).toBeCloseTo(95.05, 10);
  });
  it("returns null on empty input", () => {
    expect(percentile([], 50)).toBeNull();
    expect(quantiles([], [5, 50, 95])).toEqual([null, null, null]);
  });
});

describe("histogram", () => {
  it("counts sum to n and edges have length bins+1", () => {
    const h = histogram([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)!;
    expect(h.edges).toHaveLength(6);
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(10);
  });
  it("collapses zero-range data to a single bin", () => {
    const h = histogram([4, 4, 4], 10)!;
    expect(h.bins).toBe(1);
    expect(h.counts).toEqual([3]);
  });
  it("returns null on empty input", () => {
    expect(histogram([], 10)).toBeNull();
  });
});

describe("alignByDate", () => {
  it("pairs A at day d with B at day d+lag", () => {
    const a = new Map([
      ["2026-06-01", 10],
      ["2026-06-02", 20],
      ["2026-06-03", 30],
    ]);
    const b = new Map([
      ["2026-06-02", 200],
      ["2026-06-03", 300],
      ["2026-06-04", 400],
    ]);
    const { xs, ys, dates } = alignByDate(a, b, 1);
    expect(xs).toEqual([10, 20, 30]);
    expect(ys).toEqual([200, 300, 400]);
    expect(dates).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
  });
  it("drops non-overlapping dates at lag 0", () => {
    const a = new Map([
      ["2026-06-01", 1],
      ["2026-06-02", 2],
    ]);
    const b = new Map([["2026-06-02", 20]]);
    const { xs, ys } = alignByDate(a, b, 0);
    expect(xs).toEqual([2]);
    expect(ys).toEqual([20]);
  });
});
