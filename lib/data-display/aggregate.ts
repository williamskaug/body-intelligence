// Aggregation helpers — grouping by date, weekly buckets, training load,
// macro totals. Pure functions; no DB access here.

export type DateKeyed = { date: string };

export function groupByDate<T extends DateKeyed>(rows: ReadonlyArray<T>): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const arr = out.get(r.date);
    if (arr) arr.push(r);
    else out.set(r.date, [r]);
  }
  return out;
}

// ISO date string (YYYY-MM-DD) for the Monday of the week containing `date`.
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const back = dow === 0 ? 6 : dow - 1; // shift to Monday
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export type WeeklyBucket = {
  weekStart: string;
  totalMin: number;
  trimp: number; // duration_min × (rpe ?? 5) — a TRIMP-lite intensity-weighted load
  countByType: Record<string, number>;
};

export function weeklyBuckets(
  workouts: ReadonlyArray<{ date: string; type: string; duration_min: number | null; rpe: number | null }>,
  weeks: number,
  endDate: string,
): WeeklyBucket[] {
  const endMonday = weekStart(endDate);
  const buckets: WeeklyBucket[] = [];
  const cursor = new Date(`${endMonday}T00:00:00Z`);
  for (let i = 0; i < weeks; i++) {
    const ws = cursor.toISOString().slice(0, 10);
    buckets.unshift({ weekStart: ws, totalMin: 0, trimp: 0, countByType: {} });
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  const byWeek = new Map(buckets.map((b) => [b.weekStart, b] as const));
  for (const w of workouts) {
    const ws = weekStart(w.date);
    const bucket = byWeek.get(ws);
    if (!bucket) continue;
    const min = w.duration_min ?? 0;
    bucket.totalMin += min;
    bucket.trimp += min * (w.rpe ?? 5);
    const key = w.type.trim().toLowerCase() || "other";
    bucket.countByType[key] = (bucket.countByType[key] ?? 0) + 1;
  }
  return buckets;
}

export type MacroTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  mealsWithMacros: number;
  mealsDescriptionOnly: number;
};

export function macroTotals(
  meals: ReadonlyArray<{
    calories: number | null;
    protein_g: string | null;
    carbs_g: string | null;
    fat_g: string | null;
  }>,
): MacroTotals {
  const out: MacroTotals = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    mealsWithMacros: 0,
    mealsDescriptionOnly: 0,
  };
  for (const m of meals) {
    const hasAny =
      m.calories != null || m.protein_g != null || m.carbs_g != null || m.fat_g != null;
    if (!hasAny) {
      out.mealsDescriptionOnly += 1;
      continue;
    }
    out.mealsWithMacros += 1;
    out.calories += m.calories ?? 0;
    out.protein_g += Number(m.protein_g ?? 0);
    out.carbs_g += Number(m.carbs_g ?? 0);
    out.fat_g += Number(m.fat_g ?? 0);
  }
  return out;
}

// Sum workout duration by type, returning the top-N descending by hours.
// Used by the summary strip to replace a misleading raw count tile.
export function hoursByType(
  workouts: ReadonlyArray<{ type: string; duration_min: number | null }>,
  topN = 3,
): { entries: Array<{ type: string; hours: number }>; totalHours: number } {
  const map = new Map<string, number>();
  let total = 0;
  for (const w of workouts) {
    const min = w.duration_min ?? 0;
    if (min <= 0) continue;
    const key = w.type.trim().toLowerCase() || "other";
    map.set(key, (map.get(key) ?? 0) + min);
    total += min;
  }
  const entries = Array.from(map.entries())
    .map(([type, min]) => ({ type, hours: min / 60 }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, topN);
  return { entries, totalHours: total / 60 };
}

// Build a contiguous date array (ascending) for the window. Used to render
// timeline days even when no entries exist that day.
export function datesInRange(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

// 7-day trailing moving average over a sorted-ascending series.
export function movingAverage(values: ReadonlyArray<number | null>, window = 7): Array<number | null> {
  const out: Array<number | null> = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    let sum = 0;
    let n = 0;
    for (let j = start; j <= i; j++) {
      const v = values[j];
      if (v == null || !Number.isFinite(v)) continue;
      sum += v;
      n += 1;
    }
    out.push(n > 0 ? sum / n : null);
  }
  return out;
}
