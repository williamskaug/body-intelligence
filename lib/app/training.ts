import { weekStart } from "@/lib/data-display/aggregate";
import { normalizeType } from "@/lib/data-display/workout-types";
import { addDays, isoWeek } from "./dates";
import { num } from "./format";

export type WorkoutLike = {
  date: string;
  type: string;
  duration_min: number | null;
  distance_km: string | number | null;
  avg_hr: number | null;
  rpe: number | null;
};

export function isRunType(type: string): boolean {
  const t = normalizeType(type);
  return t === "run" || t === "trail_run";
}

export function isRideType(type: string): boolean {
  const t = normalizeType(type);
  return t === "ride" || t === "gravel_ride" || t === "mtb";
}

export function isStrengthType(type: string): boolean {
  return normalizeType(type) === "strength";
}

export function isAerobicType(type: string): boolean {
  return isRunType(type) || isRideType(type);
}

/** Metres per heartbeat — (distance_m) / (avg_hr × duration_min). */
export function runningEfficiency(
  distanceKm: number | null | undefined,
  durationMin: number | null | undefined,
  avgHr: number | null | undefined,
): number | null {
  if (
    distanceKm == null ||
    durationMin == null ||
    avgHr == null ||
    distanceKm <= 0 ||
    durationMin <= 0 ||
    avgHr <= 0
  ) {
    return null;
  }
  return (distanceKm * 1000) / (avgHr * durationMin);
}

export function applyFocus<T extends { type: string }>(workouts: ReadonlyArray<T>, focusRun: boolean): T[] {
  if (!focusRun) return [...workouts];
  return workouts.filter((w) => isRunType(w.type));
}

export type WeeklyVolume = {
  weekStart: string;
  label: string;
  runKm: number;
  aerobicHours: number;
  runHours: number;
  rideHours: number;
  strengthHours: number;
  golfHours: number;
  walkHours: number;
  otherHours: number;
  sessionCount: number;
  load: number;
  rpeFallback: number;
  isCurrent: boolean;
};

export function weeklyVolume(
  workouts: ReadonlyArray<
    WorkoutLike & { vendor_training_load?: string | number | null }
  >,
  endDate: string,
  weeks: number,
): WeeklyVolume[] {
  const endMonday = weekStart(endDate);
  const buckets: WeeklyVolume[] = [];
  const cursor = new Date(`${endMonday}T00:00:00Z`);
  for (let i = 0; i < weeks; i++) {
    const ws = cursor.toISOString().slice(0, 10);
    buckets.unshift({
      weekStart: ws,
      label: isoWeek(ws).label,
      runKm: 0,
      aerobicHours: 0,
      runHours: 0,
      rideHours: 0,
      strengthHours: 0,
      golfHours: 0,
      walkHours: 0,
      otherHours: 0,
      sessionCount: 0,
      load: 0,
      rpeFallback: 0,
      isCurrent: ws === endMonday,
    });
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  const byWeek = new Map(buckets.map((b) => [b.weekStart, b] as const));
  for (const w of workouts) {
    const bucket = byWeek.get(weekStart(w.date));
    if (!bucket) continue;
    const min = w.duration_min ?? 0;
    const hours = min / 60;
    const km = num(w.distance_km) ?? 0;
    const t = normalizeType(w.type);
    bucket.sessionCount += 1;
    if (isRunType(w.type)) {
      bucket.runKm += km;
      bucket.runHours += hours;
      bucket.aerobicHours += hours;
    } else if (isRideType(w.type)) {
      bucket.rideHours += hours;
      bucket.aerobicHours += hours;
    } else if (t === "strength") {
      bucket.strengthHours += hours;
    } else if (t === "golf") {
      bucket.golfHours += hours;
    } else if (t === "walk" || t === "hike") {
      bucket.walkHours += hours;
    } else {
      bucket.otherHours += hours;
    }
    const vendor = num(w.vendor_training_load ?? null);
    if (vendor != null && vendor > 0) {
      bucket.load += vendor;
    } else {
      bucket.load += min * (w.rpe ?? 5);
      bucket.rpeFallback += 1;
    }
  }
  return buckets;
}

export type LongRun = {
  id?: string;
  date: string;
  title: string;
  km: number;
  durationMin: number;
  avgHr: number | null;
  pace: number | null;
  decoupling: number | null;
  cadence: number | null;
  weatherC: number | null;
  notes: string | null;
};

export function isLongRun(w: WorkoutLike): boolean {
  if (!isRunType(w.type)) return false;
  const km = num(w.distance_km) ?? 0;
  const min = w.duration_min ?? 0;
  return km >= 16 || min >= 75;
}

export function weeklyRampPct(volumes: ReadonlyArray<WeeklyVolume>): Array<number | null> {
  return volumes.map((v, i) => {
    if (i === 0) return null;
    const prev = volumes[i - 1]!.runKm;
    if (prev <= 0) return null;
    return ((v.runKm - prev) / prev) * 100;
  });
}

export function thisWeekWorkouts<T extends { date: string }>(
  workouts: ReadonlyArray<T>,
  todayDate: string,
): T[] {
  const ws = weekStart(todayDate);
  const we = addDays(ws, 6);
  return workouts.filter((w) => w.date >= ws && w.date <= we);
}

export function hoursBySport(
  workouts: ReadonlyArray<WorkoutLike>,
): Array<{ type: string; hours: number }> {
  const map = new Map<string, number>();
  for (const w of workouts) {
    const min = w.duration_min ?? 0;
    if (min <= 0) continue;
    const key = normalizeType(w.type);
    map.set(key, (map.get(key) ?? 0) + min);
  }
  return Array.from(map.entries())
    .map(([type, min]) => ({ type, hours: min / 60 }))
    .sort((a, b) => b.hours - a.hours);
}

export function workoutTitle(w: {
  type: string;
  notes: string | null;
  distance_km?: string | number | null;
}): string {
  const notes = w.notes?.trim() ?? "";
  if (notes) {
    const first = notes.split(/\n/)[0]!.trim();
    if (first.length > 0 && first.length <= 80 && !/^https?:/i.test(first)) {
      return first;
    }
  }
  const t = normalizeType(w.type);
  const km = num(w.distance_km);
  if (km != null && km > 0 && (t === "run" || t === "trail_run" || t === "ride")) {
    return `${t.replace("_", " ")} ${km >= 10 ? Math.round(km) : km.toFixed(1)} km`;
  }
  return t.replace(/_/g, " ");
}
