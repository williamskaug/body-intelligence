// Shared helpers for the stats-engine tools. Resolves the "trailing window vs
// explicit range" choice at runtime (the input schemas are flat field objects,
// so there's no cross-field refine) and rounds outputs for readable JSON.

export type RangeInput = {
  window_days?: number;
  from_date?: string;
  to_date?: string;
};

// Explicit from/to wins; otherwise a trailing window ending today (UTC),
// matching get_baseline's clock.
export function resolveRange(input: RangeInput): { from: string; to: string } {
  if (input.from_date && input.to_date) {
    return { from: input.from_date, to: input.to_date };
  }
  const to = new Date();
  const toDate = to.toISOString().slice(0, 10);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (input.window_days ?? 90));
  return { from: from.toISOString().slice(0, 10), to: toDate };
}

export function round(x: number | null | undefined, digits = 4): number | null {
  if (x == null || !Number.isFinite(x)) return null;
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

// Integer day offset of `date` from `from` (both YYYY-MM-DD, UTC).
export function dayIndex(from: string, date: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${date}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}
