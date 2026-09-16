import { cache } from "react";
import { unstable_cache } from "next/cache";
import { computeBaseline } from "@/lib/data-display/baseline";
import type { DerivedDailyRow, Gate } from "@/lib/data-display/derived";
import type {
  HealthEventUpdate,
  ThreadedHealthEvent,
} from "@/lib/data-display/health-events";
import {
  daysUntil,
  nextRace,
  parseGoalSeconds,
  parseGoalsMarkdown,
  racePredictionKey,
} from "@/lib/memory/parse-goals";
import { parseThresholds } from "@/lib/memory/parse-thresholds";
import { adminClient } from "@/lib/supabase/admin";
import { addDays, isMissingRelation, localDateInTz } from "./dates";
import { sliceCacheKey, userDataTag } from "./snapshot-cache";
import type {
  CapacityRow,
  DailyRow,
  RaceInfo,
  RecipeRun,
  WorkoutMetricsRow,
  WorkoutRow,
  WorkoutZonesRow,
} from "./snapshot";
import { applyFocus } from "./training";
import type { AppWindow, FetchSpan } from "./window";
import { fetchSpan } from "./window";

const DAILY_SELECT =
  "id, date, sleep_h, sleep_deep_min, sleep_light_min, sleep_rem_min, sleep_awake_min, hrv_ms, rhr_bpm, spo2_avg_pct, respiration_avg_brpm, weight_kg, skin_temp_deviation_c, sleep_score, stress_score, body_battery_morning, body_battery_high, body_battery_low, body_battery_charged, body_battery_drained, training_readiness_score, training_status, steps, active_calories, floors_climbed, intensity_min_moderate, intensity_min_vigorous, sleep_notes, wellness_notes";

const METRICS_SELECT =
  "workout_id, date, cadence_spm, gct_ms, gct_balance_pct_left, vertical_oscillation_mm, vertical_ratio_pct, stride_len_m, te_aerobic, te_anaerobic, vendor_training_load, stamina_start_pct, stamina_end_pct, stamina_min_pct, decoupling_pct, elevation_gain_m, elevation_loss_m, avg_speed_kmh, max_speed_kmh, weather_temp_c, weather_humidity_pct, strength_volume_kg";

const ZONES_SELECT =
  "workout_id, date, hr_z1_s, hr_z2_s, hr_z3_s, hr_z4_s, hr_z5_s, power_z1_s, power_z2_s, power_z3_s, power_z4_s, power_z5_s, power_z6_s, power_z7_s";

const CAPACITY_SELECT =
  "date, vo2max_running, vo2max_cycling, lactate_threshold_hr_bpm, lactate_threshold_pace_s_per_km, lactate_threshold_power_w, cycling_ftp_w, endurance_score, race_pred_5k_s, race_pred_10k_s, race_pred_half_s, race_pred_marathon_s";

function throwQuery(label: string, error: { message: string } | null, allowMissing = false) {
  if (!error) return;
  if (allowMissing && isMissingRelation(error)) return;
  throw new Error(`${label}: ${error.message}`);
}

function sinceFor(todayDate: string, span: FetchSpan): string {
  return addDays(todayDate, -(span - 1));
}

export type WindowContext = {
  timezone: string;
  todayDate: string;
  span: FetchSpan;
  sinceDate: string;
  windowSince: string;
};

export const loadTimezone = cache(async (userId: string): Promise<string> => {
  const sb = adminClient();
  const { data } = await sb
    .from("user_profiles")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();
  const tz = (data as { timezone?: string } | null)?.timezone;
  return tz && tz !== "UTC" ? tz : "Europe/Oslo";
});

export const resolveWindowContext = cache(
  async (userId: string, window: AppWindow): Promise<WindowContext> => {
    const timezone = await loadTimezone(userId);
    const todayDate = localDateInTz(new Date(), timezone);
    const span = fetchSpan(window.days);
    return {
      timezone,
      todayDate,
      span,
      sinceDate: sinceFor(todayDate, span),
      windowSince: addDays(todayDate, -(window.days - 1)),
    };
  },
);

export const loadWorkoutsSlice = cache(async (userId: string, todayDate: string, span: FetchSpan) => {
  return unstable_cache(
    async (): Promise<WorkoutRow[]> => {
      const sb = adminClient();
      const { data, error } = await sb
        .from("workouts")
        .select(
          "id, date, type, duration_min, distance_km, avg_hr, max_hr, rpe, shoes, source, notes",
        )
        .eq("user_id", userId)
        .gte("date", sinceFor(todayDate, span))
        .order("date", { ascending: false });
      throwQuery("workouts", error);
      return (data ?? []) as WorkoutRow[];
    },
    sliceCacheKey("workouts", userId, `${todayDate}:${span}`),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

export const loadMetricsSlice = cache(async (userId: string, todayDate: string, span: FetchSpan) => {
  return unstable_cache(
    async (): Promise<Record<string, WorkoutMetricsRow>> => {
      const sb = adminClient();
      const { data, error } = await sb
        .from("workout_metrics")
        .select(METRICS_SELECT)
        .eq("user_id", userId)
        .gte("date", sinceFor(todayDate, span));
      throwQuery("workout_metrics", error, true);
      const out: Record<string, WorkoutMetricsRow> = {};
      for (const m of (data ?? []) as WorkoutMetricsRow[]) out[m.workout_id] = m;
      return out;
    },
    sliceCacheKey("metrics", userId, `${todayDate}:${span}`),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

export const loadZonesSlice = cache(async (userId: string, todayDate: string, span: FetchSpan) => {
  return unstable_cache(
    async (): Promise<Record<string, WorkoutZonesRow>> => {
      const sb = adminClient();
      const { data, error } = await sb
        .from("workout_zones")
        .select(ZONES_SELECT)
        .eq("user_id", userId)
        .gte("date", sinceFor(todayDate, span));
      throwQuery("workout_zones", error, true);
      const out: Record<string, WorkoutZonesRow> = {};
      for (const z of (data ?? []) as WorkoutZonesRow[]) out[z.workout_id] = z;
      return out;
    },
    sliceCacheKey("zones", userId, `${todayDate}:${span}`),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

export const loadDailySlice = cache(async (userId: string, todayDate: string, span: FetchSpan) => {
  return unstable_cache(
    async (): Promise<DailyRow[]> => {
      const sb = adminClient();
      const { data, error } = await sb
        .from("daily_entries")
        .select(DAILY_SELECT)
        .eq("user_id", userId)
        .gte("date", sinceFor(todayDate, span))
        .order("date", { ascending: false });
      throwQuery("daily_entries", error);
      return (data ?? []) as DailyRow[];
    },
    sliceCacheKey("daily", userId, `${todayDate}:${span}`),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

export const loadDerivedSlice = cache(async (userId: string, todayDate: string, span: FetchSpan) => {
  return unstable_cache(
    async (): Promise<DerivedDailyRow[]> => {
      const sb = adminClient();
      const { data, error } = await sb
        .from("derived_daily")
        .select("*")
        .eq("user_id", userId)
        .gte("date", sinceFor(todayDate, span))
        .order("date", { ascending: false });
      throwQuery("derived_daily", error, true);
      return (data ?? []) as DerivedDailyRow[];
    },
    sliceCacheKey("derived", userId, `${todayDate}:${span}`),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

export const loadCapacitySlice = cache(async (userId: string, todayDate: string, span: FetchSpan) => {
  return unstable_cache(
    async (): Promise<CapacityRow[]> => {
      const sb = adminClient();
      const { data, error } = await sb
        .from("capacity_metrics")
        .select(CAPACITY_SELECT)
        .eq("user_id", userId)
        .gte("date", sinceFor(todayDate, span))
        .order("date", { ascending: true });
      throwQuery("capacity_metrics", error, true);
      return (data ?? []) as CapacityRow[];
    },
    sliceCacheKey("capacity", userId, `${todayDate}:${span}`),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

export const loadEventsSlice = cache(async (userId: string) => {
  return unstable_cache(
    async (): Promise<ThreadedHealthEvent[]> => {
      const sb = adminClient();
      const [healthRes, updatesRes, milestonesRes] = await Promise.all([
        sb
          .from("health_events")
          .select("id, date, kind, body_part, severity, notes, resolved_date")
          .eq("user_id", userId)
          .order("date", { ascending: false }),
        sb
          .from("health_event_updates")
          .select("event_id, date, note, severity_at_time")
          .eq("user_id", userId)
          .order("date", { ascending: true }),
        sb
          .from("health_events")
          .select("id, next_milestone, next_milestone_date")
          .eq("user_id", userId)
          .not("next_milestone", "is", null),
      ]);
      throwQuery("health_events", healthRes.error);
      throwQuery("health_event_updates", updatesRes.error, true);
      throwQuery("health_milestones", milestonesRes.error, true);

      const updatesByEvent = new Map<string, HealthEventUpdate[]>();
      for (const u of (updatesRes.data ?? []) as Array<{ event_id: string } & HealthEventUpdate>) {
        const entry: HealthEventUpdate = {
          date: u.date,
          note: u.note,
          severity_at_time: u.severity_at_time,
        };
        const arr = updatesByEvent.get(u.event_id);
        if (arr) arr.push(entry);
        else updatesByEvent.set(u.event_id, [entry]);
      }
      const milestoneByEvent = new Map(
        (
          (milestonesRes.data ?? []) as Array<{
            id: string;
            next_milestone: string | null;
            next_milestone_date: string | null;
          }>
        ).map((m) => [m.id, m] as const),
      );
      type RawEvent = {
        id: string;
        date: string;
        kind: string;
        body_part: string | null;
        severity: number | null;
        notes: string | null;
        resolved_date: string | null;
      };
      return ((healthRes.data ?? []) as RawEvent[]).map((e) => ({
        ...e,
        next_milestone: milestoneByEvent.get(e.id)?.next_milestone ?? null,
        next_milestone_date: milestoneByEvent.get(e.id)?.next_milestone_date ?? null,
        updates: updatesByEvent.get(e.id) ?? [],
      }));
    },
    sliceCacheKey("events", userId),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

export const loadRecipesSlice = cache(async (userId: string) => {
  return unstable_cache(
    async (): Promise<RecipeRun[]> => {
      const sb = adminClient();
      const { data, error } = await sb
        .from("installed_recipes")
        .select("recipe_id, last_run_at, last_run_status, run_count")
        .eq("user_id", userId);
      throwQuery("installed_recipes", error);
      return (data ?? []) as RecipeRun[];
    },
    sliceCacheKey("recipes", userId),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

export const loadDocContents = cache(async (userId: string, paths: string[]) => {
  const unique = [...new Set(paths.filter(Boolean))].sort();
  if (unique.length === 0) return {} as Record<string, string>;
  return unstable_cache(
    async (): Promise<Record<string, string>> => {
      const sb = adminClient();
      const { data, error } = await sb
        .from("documents")
        .select("path, content")
        .eq("user_id", userId)
        .in("path", unique);
      throwQuery("documents.content", error);
      const out: Record<string, string> = {};
      for (const row of (data ?? []) as Array<{ path: string; content: string }>) {
        out[row.path] = row.content;
      }
      return out;
    },
    sliceCacheKey("docs", userId, unique.join("|")),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

export const loadLatestPath = cache(async (userId: string, prefix: string, prefer?: string | null) => {
  return unstable_cache(
    async (): Promise<string | null> => {
      const sb = adminClient();
      const { data, error } = await sb
        .from("documents")
        .select("path")
        .eq("user_id", userId)
        .like("path", `${prefix}%`)
        .order("path", { ascending: false })
        .limit(8);
      throwQuery(`documents.${prefix}`, error);
      const paths = ((data ?? []) as Array<{ path: string }>).map((d) => d.path);
      if (prefer && paths.includes(prefer)) return prefer;
      return paths[0] ?? null;
    },
    sliceCacheKey("latest-path", userId, `${prefix}:${prefer ?? ""}`),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

export function filterWorkouts(
  rows: WorkoutRow[],
  windowSince: string,
  focusRun: boolean,
): { allWorkouts: WorkoutRow[]; workouts: WorkoutRow[] } {
  const focused = applyFocus(rows, focusRun);
  return {
    allWorkouts: focused,
    workouts: focused.filter((w) => w.date >= windowSince),
  };
}

export function derivedPack(rows: DerivedDailyRow[], todayDate: string, windowSince: string) {
  const derivedGateByDate: Record<string, Gate> = {};
  for (const d of rows) {
    if (d.readiness_gate) derivedGateByDate[d.date] = d.readiness_gate;
  }
  const gateHistory = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(todayDate, -(13 - i));
    return { date, gate: derivedGateByDate[date] ?? null };
  });
  return {
    derived: rows.filter((d) => d.date >= windowSince),
    derivedAll: rows,
    derivedGateByDate,
    gateHistory,
  };
}

export function dailyPack(rows: DailyRow[], todayDate: string, windowSince: string) {
  const dailyForBase = rows.filter((d) => d.date >= addDays(todayDate, -59));
  return {
    daily: rows.filter((d) => d.date >= windowSince),
    dailyHistory: rows,
    baselines: {
      hrv: computeBaseline(dailyForBase.map((d) => d.hrv_ms)),
      rhr: computeBaseline(dailyForBase.map((d) => d.rhr_bpm)),
      sleep: computeBaseline(dailyForBase.map((d) => (d.sleep_h == null ? null : Number(d.sleep_h)))),
    },
  };
}

export function raceFromGoals(goalsMd: string, todayDate: string): RaceInfo | null {
  const races = parseGoalsMarkdown(goalsMd);
  const targetRace = nextRace(races, todayDate);
  if (!targetRace) return null;
  return {
    name: targetRace.name,
    date: targetRace.date,
    daysOut: daysUntil(targetRace.date, todayDate),
    tier: targetRace.tier,
    distance: targetRace.distance,
    goal: targetRace.goal,
    goalSeconds: parseGoalSeconds(targetRace.goal),
    predKey: racePredictionKey(targetRace.distance),
  };
}

export function thresholdsFromDoc(raw: string | undefined) {
  return raw ? parseThresholds(raw) : null;
}
