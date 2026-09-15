import { cache } from "react";
import { unstable_cache } from "next/cache";
import { computeBaseline, type Baseline } from "@/lib/data-display/baseline";
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
  type ParsedRace,
} from "@/lib/memory/parse-goals";
import { parseThresholds, type ParsedThresholds } from "@/lib/memory/parse-thresholds";
import { adminClient } from "@/lib/supabase/admin";
import { addDays, isMissingRelation, localDateInTz } from "./dates";
import { timeAgo } from "./format";
import {
  dehydrateContentMap,
  hydrateContentMap,
  snapshotCacheKey,
  statusChromeCacheKey,
  userDataTag,
} from "./snapshot-cache";
import { applyFocus, isRunType, workoutTitle } from "./training";
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

const STANDARD_DOCS = [
  "MEMORY.md",
  "PROFILE.md",
  "PRINCIPLES.md",
  "GOALS.md",
  "CURRENT.md",
  "HEALTH_LOG.md",
  "NUTRITION.md",
  "EQUIPMENT.md",
  "THRESHOLDS.md",
  "RECORDS.md",
] as const;

const DAILY_SELECT =
  "id, date, sleep_h, sleep_deep_min, sleep_light_min, sleep_rem_min, sleep_awake_min, hrv_ms, rhr_bpm, spo2_avg_pct, respiration_avg_brpm, weight_kg, skin_temp_deviation_c, sleep_score, stress_score, body_battery_morning, body_battery_high, body_battery_low, body_battery_charged, body_battery_drained, training_readiness_score, training_status, steps, active_calories, floors_climbed, intensity_min_moderate, intensity_min_vigorous, sleep_notes, wellness_notes";

const METRICS_SELECT =
  "workout_id, date, cadence_spm, gct_ms, gct_balance_pct_left, vertical_oscillation_mm, vertical_ratio_pct, stride_len_m, te_aerobic, te_anaerobic, vendor_training_load, stamina_start_pct, stamina_end_pct, stamina_min_pct, decoupling_pct, elevation_gain_m, elevation_loss_m, avg_speed_kmh, max_speed_kmh, weather_temp_c, weather_humidity_pct, strength_volume_kg";

const ZONES_SELECT =
  "workout_id, date, hr_z1_s, hr_z2_s, hr_z3_s, hr_z4_s, hr_z5_s, power_z1_s, power_z2_s, power_z3_s, power_z4_s, power_z5_s, power_z6_s, power_z7_s";

const CAPACITY_SELECT =
  "date, vo2max_running, vo2max_cycling, lactate_threshold_hr_bpm, lactate_threshold_pace_s_per_km, lactate_threshold_power_w, cycling_ftp_w, endurance_score, race_pred_5k_s, race_pred_10k_s, race_pred_half_s, race_pred_marathon_s";

async function loadAppSnapshotUncached(
  userId: string,
  email: string,
  window: AppWindow,
): Promise<AppSnapshot> {
  const timezone = await loadTimezone(userId);
  const todayDate = localDateInTz(new Date(), timezone);
  // Charts that show weekly history need more than the chip window; always
  // pull at least 120 days so BUILD/TODAY have a runway, capped by 1Y.
  const fetchDays = Math.max(window.days, 120);
  const sinceDate = addDays(todayDate, -(fetchDays - 1));
  const windowSince = addDays(todayDate, -(window.days - 1));

  const sb = adminClient();
  const [
    workoutsRes,
    dailyRes,
    healthRes,
    documentsRes,
    derivedRes,
    metricsRes,
    zonesRes,
    updatesRes,
    recipesRes,
    milestonesRes,
    capacityRes,
  ] = await Promise.all([
    sb
      .from("workouts")
      .select(
        "id, date, type, duration_min, distance_km, avg_hr, max_hr, rpe, shoes, source, notes",
      )
      .eq("user_id", userId)
      .gte("date", sinceDate)
      .order("date", { ascending: false }),
    sb
      .from("daily_entries")
      .select(DAILY_SELECT)
      .eq("user_id", userId)
      .gte("date", sinceDate)
      .order("date", { ascending: false }),
    sb
      .from("health_events")
      .select("id, date, kind, body_part, severity, notes, resolved_date")
      .eq("user_id", userId)
      .order("date", { ascending: false }),
    sb
      .from("documents")
      .select("path, updated_at")
      .eq("user_id", userId)
      .order("path", { ascending: true }),
    sb
      .from("derived_daily")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceDate)
      .order("date", { ascending: false }),
    sb
      .from("workout_metrics")
      .select(METRICS_SELECT)
      .eq("user_id", userId)
      .gte("date", sinceDate),
    sb
      .from("workout_zones")
      .select(ZONES_SELECT)
      .eq("user_id", userId)
      .gte("date", sinceDate),
    sb
      .from("health_event_updates")
      .select("event_id, date, note, severity_at_time")
      .eq("user_id", userId)
      .order("date", { ascending: true }),
    sb
      .from("installed_recipes")
      .select("recipe_id, last_run_at, last_run_status, run_count")
      .eq("user_id", userId),
    sb
      .from("health_events")
      .select("id, next_milestone, next_milestone_date")
      .eq("user_id", userId)
      .not("next_milestone", "is", null),
    sb
      .from("capacity_metrics")
      .select(CAPACITY_SELECT)
      .eq("user_id", userId)
      .gte("date", sinceDate)
      .order("date", { ascending: true }),
  ]);

  for (const r of [workoutsRes, dailyRes, healthRes, documentsRes, recipesRes]) {
    if (r.error) throw new Error(r.error.message);
  }
  for (const r of [derivedRes, metricsRes, zonesRes, updatesRes, milestonesRes, capacityRes]) {
    if (r.error && !isMissingRelation(r.error)) throw new Error(r.error.message);
  }

  const allWorkouts = (workoutsRes.data ?? []) as WorkoutRow[];
  const workouts = applyFocus(allWorkouts, window.focusRun).filter(
    (w) => w.date >= windowSince,
  );

  const daily = (dailyRes.data ?? []) as DailyRow[];
  const derived = (derivedRes.data ?? []) as DerivedDailyRow[];
  const derivedGateByDate: Record<string, Gate> = {};
  for (const d of derived) {
    if (d.readiness_gate) derivedGateByDate[d.date] = d.readiness_gate;
  }

  const metricsByWorkoutId: Record<string, WorkoutMetricsRow> = {};
  for (const m of (metricsRes.data ?? []) as WorkoutMetricsRow[]) {
    metricsByWorkoutId[m.workout_id] = m;
  }
  const zonesByWorkoutId: Record<string, WorkoutZonesRow> = {};
  for (const z of (zonesRes.data ?? []) as WorkoutZonesRow[]) {
    zonesByWorkoutId[z.workout_id] = z;
  }

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
    ((milestonesRes.data ?? []) as Array<{
      id: string;
      next_milestone: string | null;
      next_milestone_date: string | null;
    }>).map((m) => [m.id, m] as const),
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
  const events: ThreadedHealthEvent[] = ((healthRes.data ?? []) as RawEvent[]).map((e) => ({
    ...e,
    next_milestone: milestoneByEvent.get(e.id)?.next_milestone ?? null,
    next_milestone_date: milestoneByEvent.get(e.id)?.next_milestone_date ?? null,
    updates: updatesByEvent.get(e.id) ?? [],
  }));

  const docMeta = (documentsRes.data ?? []) as Array<{ path: string; updated_at: string }>;
  const briefingMeta = docMeta
    .filter((d) => d.path.startsWith("briefings/"))
    .sort((a, b) => b.path.localeCompare(a.path));
  const insightsMeta = docMeta
    .filter((d) => d.path.startsWith("insights/"))
    .sort((a, b) => b.path.localeCompare(a.path));
  const latestBriefingPath =
    briefingMeta.find((b) => b.path === `briefings/${todayDate}.md`)?.path ??
    briefingMeta[0]?.path ??
    null;
  const latestInsightPath = insightsMeta[0]?.path ?? null;

  const contentPaths = [
    ...STANDARD_DOCS.filter((p) => docMeta.some((d) => d.path === p)),
    ...(latestBriefingPath ? [latestBriefingPath] : []),
    ...(latestInsightPath ? [latestInsightPath] : []),
  ];
  const contentRows = contentPaths.length
    ? await sb.from("documents").select("path, content").eq("user_id", userId).in("path", contentPaths)
    : { data: [] as Array<{ path: string; content: string }>, error: null };
  if (contentRows.error) throw new Error(contentRows.error.message);
  const contentByPath = new Map(
    ((contentRows.data ?? []) as Array<{ path: string; content: string }>).map(
      (r) => [r.path, r.content] as const,
    ),
  );

  const documents: DocMeta[] = docMeta.map((d) => ({
    path: d.path,
    updated_at: d.updated_at,
    content: contentByPath.get(d.path) ?? null,
  }));

  const goalsDoc = contentByPath.get("GOALS.md") ?? "";
  const races = parseGoalsMarkdown(goalsDoc);
  const targetRace = nextRace(races, todayDate);
  const race: RaceInfo | null = targetRace
    ? {
        name: targetRace.name,
        date: targetRace.date,
        daysOut: daysUntil(targetRace.date, todayDate),
        tier: targetRace.tier,
        distance: targetRace.distance,
        goal: targetRace.goal,
        goalSeconds: parseGoalSeconds(targetRace.goal),
        predKey: racePredictionKey(targetRace.distance),
      }
    : null;

  const gateHistory = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(todayDate, -(13 - i));
    return { date, gate: derivedGateByDate[date] ?? null };
  });

  const dailyForBase = daily.filter((d) => d.date >= addDays(todayDate, -59));
  const baselines = {
    hrv: computeBaseline(dailyForBase.map((d) => d.hrv_ms)),
    rhr: computeBaseline(dailyForBase.map((d) => d.rhr_bpm)),
    sleep: computeBaseline(dailyForBase.map((d) => (d.sleep_h == null ? null : Number(d.sleep_h)))),
  };

  const thresholdsRaw = contentByPath.get("THRESHOLDS.md") ?? "";
  const thresholds = thresholdsRaw ? parseThresholds(thresholdsRaw) : null;

  return {
    userId,
    email,
    todayDate,
    sinceDate: windowSince,
    days: window.days,
    focusRun: window.focusRun,
    timezone,
    workouts,
    allWorkouts: applyFocus(allWorkouts, window.focusRun),
    daily: daily.filter((d) => d.date >= windowSince),
    dailyHistory: daily,
    derived: derived.filter((d) => d.date >= windowSince),
    derivedGateByDate,
    metricsByWorkoutId,
    zonesByWorkoutId,
    events,
    capacity: (capacityRes.data ?? []) as CapacityRow[],
    documents,
    contentByPath,
    recipes: (recipesRes.data ?? []) as RecipeRun[],
    race,
    gateHistory,
    baselines,
    thresholds,
    latestBriefingPath,
    latestInsightPath,
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

export async function loadDocument(
  userId: string,
  path: string,
): Promise<{ path: string; content: string; updated_at: string } | null> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("documents")
    .select("path, content, updated_at")
    .eq("user_id", userId)
    .eq("path", path)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { path: string; content: string; updated_at: string } | null) ?? null;
}

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
