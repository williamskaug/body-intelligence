import type { AppSnapshot } from "@/lib/app/snapshot";
import type { Gate } from "@/lib/data-display/derived";

export function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-neutral-400">{k}</dt>
      <dd className="font-mono text-[12px] tabular-nums">{v}</dd>
    </div>
  );
}

export function latestNonNull(arr: ReadonlyArray<number | null> | undefined): number | null {
  if (!arr) return null;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]!;
  return null;
}

export function maxHr(snapshot: AppSnapshot, pred: (w: AppSnapshot["workouts"][number]) => boolean): number | null {
  let max: number | null = null;
  for (const w of snapshot.allWorkouts) {
    if (!pred(w) || w.max_hr == null) continue;
    if (max == null || w.max_hr > max) max = w.max_hr;
  }
  return max;
}

export function expandGates(snapshot: AppSnapshot): Array<{ date: string; gate: Gate | null }> {
  return snapshot.derived
    .slice(0, 90)
    .map((d) => ({ date: d.date, gate: d.readiness_gate }))
    .reverse();
}

export function toHistBins(hist: { edges: number[]; counts: number[] } | null) {
  if (!hist) return [];
  const out: Array<{ binStart: number; binEnd: number; count: number }> = [];
  for (let k = 0; k < hist.counts.length; k++) {
    out.push({
      binStart: hist.edges[k]!,
      binEnd: hist.edges[k + 1] ?? hist.edges[k]!,
      count: hist.counts[k]!,
    });
  }
  return out;
}
