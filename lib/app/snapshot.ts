import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Baseline } from "@/lib/data-display/baseline";
import type { DerivedDailyRow, Gate } from "@/lib/data-display/derived";
import type { ThreadedHealthEvent } from "@/lib/data-display/health-events";
import type { ParsedRace } from "@/lib/memory/parse-goals";
import type { ParsedThresholds } from "@/lib/memory/parse-thresholds";
import { adminClient } from "@/lib/supabase/admin";
import { addDays, isMissingRelation, localDateInTz } from "./dates";
import { timeAgo } from "./format";
import {
  dailyPack,
  derivedPack,
  filterWorkouts,
  loadCapacitySlice,
  loadDailySlice,
  loadDerivedSlice,
  loadDocContents,
  loadEventsSlice,
  loadLatestPath,
  loadMetricsSlice,
  loadRecipesSlice,
  loadTimezone as loadTimezoneSlice,
  loadWorkoutsSlice,
  loadZonesSlice,
  raceFromGoals,
  resolveWindowContext,
  thresholdsFromDoc,
} from "./data-slices";
import {
  dehydrateContentMap,
  hydrateContentMap,
  snapshotCacheKey,
  statusChromeCacheKey,
  userDataTag,
} from "./snapshot-cache";
import { isRunType, workoutTitle } from "./training";
import type { AppWindow, WindowDays } from "./window";

export type DawnFooter = {
  status: "ok" | "failed" | "stale" | "none";
  lastRunLabel: string | null;
};

export type WorkoutRow = {
  id: string;
  date: string;
  type: string;
  duration_min: number | null;
  distance_km: string | null;
  avg_hr: number | null;
  max_hr: number | null;
  rpe: number | null;
  shoes: string | null;
  source: string;
  notes: string | null;
};

export type WorkoutMetricsRow = {
  workout_id: string;
  date: string;
  cadence_spm: string | null;
  gct_ms: number | null;
  gct_balance_pct_left: string | null;
  vertical_oscillation_mm: string | null;
  vertical_ratio_pct: string | null;
  stride_len_m: string | null;
  te_aerobic: string | null;
  te_anaerobic: string | null;
  vendor_training_load: string | null;
  stamina_start_pct: number | null;
  stamina_end_pct: number | null;
  stamina_min_pct: number | null;
  decoupling_pct: string | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  avg_speed_kmh: string | null;
  max_speed_kmh: string | null;
  weather_temp_c: string | null;
  weather_humidity_pct: string | null;
  strength_volume_kg: string | null;
};

export type WorkoutZonesRow = {
  workout_id: string;
  date: string;
  hr_z1_s: number | null;
  hr_z2_s: number | null;
  hr_z3_s: number | null;
  hr_z4_s: number | null;
  hr_z5_s: number | null;
  power_z1_s: number | null;
  power_z2_s: number | null;
  power_z3_s: number | null;
  power_z4_s: number | null;
  power_z5_s: number | null;
  power_z6_s: number | null;
  power_z7_s: number | null;
};

export type DailyRow = {
  id: string;
  date: string;
  sleep_h: string | null;
  sleep_deep_min: number | null;
  sleep_light_min: number | null;
  sleep_rem_min: number | null;
  sleep_awake_min: number | null;
  hrv_ms: number | null;
  rhr_bpm: number | null;
  spo2_avg_pct: string | null;
  respiration_avg_brpm: string | null;
  weight_kg: string | null;
  skin_temp_deviation_c: string | null;
  sleep_score: number | null;
  stress_score: number | null;
  body_battery_morning: number | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  body_battery_charged: number | null;
  body_battery_drained: number | null;
  training_readiness_score: number | null;
  training_status: string | null;
  steps: number | null;
  active_calories: number | null;
  floors_climbed: number | null;
  intensity_min_moderate: number | null;
  intensity_min_vigorous: number | null;
  sleep_notes: string | null;
  wellness_notes: string | null;
};

export type CapacityRow = {
  date: string;
  vo2max_running: string | null;
  vo2max_cycling: string | null;
  lactate_threshold_hr_bpm: number | null;
  lactate_threshold_pace_s_per_km: number | null;
  lactate_threshold_power_w: number | null;
  cycling_ftp_w: number | null;
  endurance_score: number | null;
  race_pred_5k_s: number | null;
  race_pred_10k_s: number | null;
  race_pred_half_s: number | null;
  race_pred_marathon_s: number | null;
};

export type RecipeRun = {
  recipe_id: string;
  last_run_at: string | null;
  last_run_status: string | null;
  run_count: number;
};

export type DocMeta = { path: string; updated_at: string; content: string | null };

export type RaceInfo = {
  name: string;
  date: string;
  daysOut: number;
  tier: ParsedRace["tier"];
  distance: string | null;
  goal: string | null;
  goalSeconds: number | null;
  predKey: string | null;
};

export type AppSnapshot = {
  userId: string;
  email: string;
  todayDate: string;
  sinceDate: string;
  days: number;
  focusRun: boolean;
  timezone: string;
  workouts: WorkoutRow[];
  allWorkouts: WorkoutRow[];
  daily: DailyRow[];
  /** Unfiltered fetch window (≥120d) so Body/Analyze charts keep a runway. */
  dailyHistory: DailyRow[];
  derived: DerivedDailyRow[];
  derivedGateByDate: Record<string, Gate>;
  metricsByWorkoutId: Record<string, WorkoutMetricsRow>;
  zonesByWorkoutId: Record<string, WorkoutZonesRow>;
  events: ThreadedHealthEvent[];
  capacity: CapacityRow[];
  documents: DocMeta[];
  contentByPath: Map<string, string>;
  recipes: RecipeRun[];
  race: RaceInfo | null;
  gateHistory: Array<{ date: string; gate: Gate | null }>;
  baselines: {
    hrv: Baseline | null;
    rhr: Baseline | null;
    sleep: Baseline | null;
  };
  thresholds: ParsedThresholds | null;
  latestBriefingPath: string | null;
  latestInsightPath: string | null;
};

export function emptySnapshot(base: {
  userId: string;
  email: string;
  todayDate: string;
  sinceDate: string;
  days: number;
  focusRun: boolean;
  timezone: string;
}): AppSnapshot {
  return {
    ...base,
    workouts: [],
    allWorkouts: [],
    daily: [],
    dailyHistory: [],
    derived: [],
    derivedGateByDate: {},
    metricsByWorkoutId: {},
    zonesByWorkoutId: {},
    events: [],
    capacity: [],
    documents: [],
    contentByPath: new Map(),
    recipes: [],
    race: null,
    gateHistory: [],
    baselines: { hrv: null, rhr: null, sleep: null },
    thresholds: null,
    latestBriefingPath: null,
    latestInsightPath: null,
  };
}

async function loadAppSnapshotUncached(
  userId: string,
  email: string,
  window: AppWindow,
): Promise<AppSnapshot> {
  const ctx = await resolveWindowContext(userId, window);
  const [workouts, metricsByWorkoutId, zonesByWorkoutId, dailyRows, derivedRows, events, capacity, recipes, briefingPath, insightPath] =
    await Promise.all([
      loadWorkoutsSlice(userId, ctx.todayDate, ctx.span),
      loadMetricsSlice(userId, ctx.todayDate, ctx.span),
      loadZonesSlice(userId, ctx.todayDate, ctx.span),
      loadDailySlice(userId, ctx.todayDate, ctx.span),
      loadDerivedSlice(userId, ctx.todayDate, ctx.span),
      loadEventsSlice(userId),
      loadCapacitySlice(userId, ctx.todayDate, ctx.span),
      loadRecipesSlice(userId),
      loadLatestPath(userId, "briefings/", `briefings/${ctx.todayDate}.md`),
      loadLatestPath(userId, "insights/"),
    ]);
  const contentByPath = new Map(
    Object.entries(
      await loadDocContents(userId, [
        "GOALS.md",
        "CURRENT.md",
        "THRESHOLDS.md",
        "HEALTH_LOG.md",
        ...(briefingPath ? [briefingPath] : []),
        ...(insightPath ? [insightPath] : []),
      ]),
    ),
  );
  const { allWorkouts, workouts: windowWorkouts } = filterWorkouts(
    workouts,
    ctx.windowSince,
    window.focusRun,
  );
  const daily = dailyPack(dailyRows, ctx.todayDate, ctx.windowSince);
  const derived = derivedPack(derivedRows, ctx.todayDate, ctx.windowSince);
  return {
    userId,
    email,
    todayDate: ctx.todayDate,
    sinceDate: ctx.windowSince,
    days: window.days,
    focusRun: window.focusRun,
    timezone: ctx.timezone,
    workouts: windowWorkouts,
    allWorkouts,
    daily: daily.daily,
    dailyHistory: daily.dailyHistory,
    derived: derived.derived,
    derivedGateByDate: derived.derivedGateByDate,
    metricsByWorkoutId,
    zonesByWorkoutId,
    events,
    capacity,
    documents: [],
    contentByPath,
    recipes,
    race: raceFromGoals(contentByPath.get("GOALS.md") ?? "", ctx.todayDate),
    gateHistory: derived.gateHistory,
    baselines: daily.baselines,
    thresholds: thresholdsFromDoc(contentByPath.get("THRESHOLDS.md")),
    latestBriefingPath: briefingPath,
    latestInsightPath: insightPath,
  };
}

type SnapshotDTO = Omit<AppSnapshot, "contentByPath"> & {
  contentByPath: Record<string, string>;
};

/** Per-request + 45s tagged cache. Section switches reuse this instead of 12 DB round-trips. */
export async function loadAppSnapshot(
  userId: string,
  email: string,
  window: AppWindow,
): Promise<AppSnapshot> {
  return cachedSnapshot(userId, email, window.days, window.focusRun);
}

const cachedSnapshot = cache(
  async (userId: string, email: string, days: WindowDays, focusRun: boolean): Promise<AppSnapshot> => {
    const dto = await unstable_cache(
      async (): Promise<SnapshotDTO> => {
        const snap = await loadAppSnapshotUncached(userId, email, { days, focusRun });
        return { ...snap, contentByPath: dehydrateContentMap(snap.contentByPath) };
      },
      snapshotCacheKey(userId, email, days, focusRun),
      { tags: [userDataTag(userId)], revalidate: 45 },
    )();
    return { ...dto, contentByPath: hydrateContentMap(dto.contentByPath) };
  },
);

export const loadTimezone = loadTimezoneSlice;

export const loadDocument = cache(
  async (
    userId: string,
    path: string,
  ): Promise<{ path: string; content: string; updated_at: string } | null> => {
    return unstable_cache(
      async () => {
        const sb = adminClient();
        const { data, error } = await sb
          .from("documents")
          .select("path, content, updated_at")
          .eq("user_id", userId)
          .eq("path", path)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return (data as { path: string; content: string; updated_at: string } | null) ?? null;
      },
      ["doc", userId, path],
      { tags: [userDataTag(userId)], revalidate: 45 },
    )();
  },
);

/** Paths only — Memory does not need the 120-day workout snapshot. */
export const loadDocumentIndex = cache(async (userId: string) => {
  return unstable_cache(
    async (): Promise<Array<{ path: string; updated_at: string }>> => {
      const sb = adminClient();
      const { data, error } = await sb
        .from("documents")
        .select("path, updated_at")
        .eq("user_id", userId)
        .order("path", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ path: string; updated_at: string }>;
    },
    ["doc-index", userId],
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

export const requireUser = cache(async (): Promise<{ id: string; email: string } | null> => {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
});

export const loadDawnFooter = cache(async (userId: string): Promise<DawnFooter> => {
  return unstable_cache(
    async (): Promise<DawnFooter> => {
      const sb = adminClient();
      const { data } = await sb
        .from("installed_recipes")
        .select("last_run_at, last_run_status")
        .eq("user_id", userId)
        .eq("recipe_id", "dawn-agent")
        .maybeSingle();
      const row = data as { last_run_at: string | null; last_run_status: string | null } | null;
      if (!row?.last_run_at) return { status: "none", lastRunLabel: null };
      const ageH = (Date.now() - new Date(row.last_run_at).getTime()) / 3_600_000;
      const status: DawnFooter["status"] =
        row.last_run_status === "failed" ? "failed" : ageH > 36 ? "stale" : "ok";
      const label = new Date(row.last_run_at).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return {
        status,
        lastRunLabel: ageH < 24 ? `ran ${label}` : `ran ${timeAgo(row.last_run_at)}`,
      };
    },
    ["dawn-footer", userId],
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

/** Lightweight chrome for the shared layout — not the 120-day snapshot. */
export type StatusChrome = {
  todayDate: string;
  derived: DerivedDailyRow | null;
  hrvMs: number | null;
  rhrBpm: number | null;
  todayWorkout: { type: string; title: string } | null;
  briefingPath: string | null;
  insightPath: string | null;
  gateHistory: Array<{ date: string; gate: Gate | null }>;
};

export const loadStatusChrome = cache(async (userId: string): Promise<StatusChrome> => {
  return unstable_cache(
    async () => loadStatusChromeUncached(userId),
    statusChromeCacheKey(userId),
    { tags: [userDataTag(userId)], revalidate: 45 },
  )();
});

async function loadStatusChromeUncached(userId: string): Promise<StatusChrome> {
  const timezone = await loadTimezone(userId);
  const todayDate = localDateInTz(new Date(), timezone);
  const since14 = addDays(todayDate, -13);
  const sb = adminClient();
  const [derivedRes, dailyRes, workoutRes, briefingRes, insightRes] = await Promise.all([
    sb
      .from("derived_daily")
      .select("*")
      .eq("user_id", userId)
      .gte("date", since14)
      .order("date", { ascending: false }),
    sb
      .from("daily_entries")
      .select("date, hrv_ms, rhr_bpm")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(3),
    sb
      .from("workouts")
      .select("date, type, notes, distance_km")
      .eq("user_id", userId)
      .eq("date", todayDate)
      .limit(1),
    sb
      .from("documents")
      .select("path")
      .eq("user_id", userId)
      .like("path", "briefings/%")
      .order("path", { ascending: false })
      .limit(5),
    sb
      .from("documents")
      .select("path")
      .eq("user_id", userId)
      .like("path", "insights/%")
      .order("path", { ascending: false })
      .limit(1),
  ]);

  for (const r of [derivedRes, dailyRes, workoutRes, briefingRes, insightRes]) {
    if (r.error && !isMissingRelation(r.error)) throw new Error(r.error.message);
  }

  const derivedRows = (derivedRes.data ?? []) as DerivedDailyRow[];
  const derivedToday =
    derivedRows.find((d) => d.date === todayDate) ?? derivedRows[0] ?? null;
  const derivedGateByDate: Record<string, Gate> = {};
  for (const d of derivedRows) {
    if (d.readiness_gate) derivedGateByDate[d.date] = d.readiness_gate;
  }
  const gateHistory = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(todayDate, -(13 - i));
    return { date, gate: derivedGateByDate[date] ?? null };
  });

  const dailyRows = (dailyRes.data ?? []) as Array<{
    date: string;
    hrv_ms: number | null;
    rhr_bpm: number | null;
  }>;
  const todayDaily = dailyRows.find((d) => d.date === todayDate) ?? dailyRows[0] ?? null;

  const workout = (workoutRes.data ?? [])[0] as
    | { date: string; type: string; notes: string | null; distance_km: string | null }
    | undefined;

  const briefingPaths = ((briefingRes.data ?? []) as Array<{ path: string }>).map((d) => d.path);
  const briefingPath =
    briefingPaths.find((p) => p === `briefings/${todayDate}.md`) ?? briefingPaths[0] ?? null;
  const insightPath = ((insightRes.data ?? []) as Array<{ path: string }>)[0]?.path ?? null;

  return {
    todayDate,
    derived: derivedToday,
    hrvMs: todayDaily?.hrv_ms ?? null,
    rhrBpm: todayDaily?.rhr_bpm ?? null,
    todayWorkout: workout
      ? {
          type: isRunType(workout.type) ? "run" : workout.type,
          title: workoutTitle(workout),
        }
      : null,
    briefingPath,
    insightPath,
    gateHistory,
  };
}
