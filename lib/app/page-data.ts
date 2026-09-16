import { cachedLoadBalance } from "@/lib/app/analyze-extras";
import type { AnalyzeTab } from "@/lib/app/analyze-tabs";
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
  loadTimezone,
  loadWorkoutsSlice,
  loadZonesSlice,
  raceFromGoals,
  resolveWindowContext,
  thresholdsFromDoc,
} from "@/lib/app/data-slices";
import { emptySnapshot, type AppSnapshot, type CapacityRow, type DailyRow } from "@/lib/app/snapshot";
import type { ThreadedHealthEvent } from "@/lib/data-display/health-events";
import type { AppWindow } from "@/lib/app/window";
import { localDateInTz } from "./dates";

/**
 * Which cached slices each route actually waits on. Health/Body/Memory never
 * pull the workout snapshot; Analyze extras are tab-scoped.
 */
export const ROUTE_SLICES = {
  today: ["workouts", "metrics", "daily", "derived", "events", "capacity", "docs:goals+current+briefing", "load-balance"],
  train: ["workouts", "metrics", "zones", "derived"],
  "analyze:build": ["workouts", "metrics", "load-balance", "docs:insight"],
  "analyze:fitness": ["workouts", "capacity", "docs:goals+thresholds", "capacity-series"],
  "analyze:long-run": ["workouts", "metrics"],
  "analyze:intensity": ["workouts", "zones"],
  "analyze:form": ["workouts", "metrics", "events"],
  "analyze:recovery": ["workouts", "metrics", "zones", "daily", "derived", "recovery-series"],
  "analyze:stats": ["load-balance", "matrix", "dists", "daily"],
  body: ["daily", "capacity"],
  health: ["events", "docs:HEALTH_LOG"],
  memory: ["doc-index", "one-doc"],
  agents: ["install-state", "recipe-docs", "capture-gaps"],
  settings: ["profile", "oauth-tokens", "source-heartbeat"],
} as const;

export type BodyPageData = {
  todayDate: string;
  dailyHistory: DailyRow[];
  capacity: Array<Pick<CapacityRow, "date" | "vo2max_running">>;
};

export type HealthPageData = {
  todayDate: string;
  events: ThreadedHealthEvent[];
  healthLog: string | null;
};

function baseSnap(
  userId: string,
  email: string,
  window: AppWindow,
  ctx: Awaited<ReturnType<typeof resolveWindowContext>>,
): AppSnapshot {
  return emptySnapshot({
    userId,
    email,
    todayDate: ctx.todayDate,
    sinceDate: ctx.windowSince,
    days: window.days,
    focusRun: window.focusRun,
    timezone: ctx.timezone,
  });
}

export async function loadTodayPageData(
  userId: string,
  email: string,
  window: AppWindow,
): Promise<{ snapshot: AppSnapshot; ctl: number | null; tsb: number | null; ctlRamp: number | null }> {
  const ctx = await resolveWindowContext(userId, window);
  const [workouts, metricsByWorkoutId, dailyRows, derivedRows, events, capacity, briefingPath, insightPath, load] =
    await Promise.all([
      loadWorkoutsSlice(userId, ctx.todayDate, ctx.span),
      loadMetricsSlice(userId, ctx.todayDate, ctx.span),
      loadDailySlice(userId, ctx.todayDate, ctx.span),
      loadDerivedSlice(userId, ctx.todayDate, ctx.span),
      loadEventsSlice(userId),
      loadCapacitySlice(userId, ctx.todayDate, ctx.span),
      loadLatestPath(userId, "briefings/", `briefings/${ctx.todayDate}.md`),
      loadLatestPath(userId, "insights/"),
      cachedLoadBalance(userId, Math.max(window.days, 84)).catch(() => null),
    ]);
  const content = await loadDocContents(userId, [
    "GOALS.md",
    "CURRENT.md",
    ...(briefingPath ? [briefingPath] : []),
    ...(insightPath ? [insightPath] : []),
  ]);
  const { allWorkouts, workouts: windowWorkouts } = filterWorkouts(
    workouts,
    ctx.windowSince,
    window.focusRun,
  );
  const daily = dailyPack(dailyRows, ctx.todayDate, ctx.windowSince);
  const derived = derivedPack(derivedRows, ctx.todayDate, ctx.windowSince);
  const snapshot = baseSnap(userId, email, window, ctx);
  snapshot.workouts = windowWorkouts;
  snapshot.allWorkouts = allWorkouts;
  snapshot.metricsByWorkoutId = metricsByWorkoutId;
  snapshot.daily = daily.daily;
  snapshot.dailyHistory = daily.dailyHistory;
  snapshot.baselines = daily.baselines;
  snapshot.derived = derived.derived;
  snapshot.derivedGateByDate = derived.derivedGateByDate;
  snapshot.gateHistory = derived.gateHistory;
  snapshot.events = events;
  snapshot.capacity = capacity;
  snapshot.contentByPath = new Map(Object.entries(content));
  snapshot.race = raceFromGoals(content["GOALS.md"] ?? "", ctx.todayDate);
  snapshot.latestBriefingPath = briefingPath;
  snapshot.latestInsightPath = insightPath;
  return {
    snapshot,
    ctl: load?.current.ctl ?? null,
    tsb: load?.current.tsb ?? null,
    ctlRamp: load?.current.ctl_ramp_7d ?? null,
  };
}

export async function loadTrainPageData(
  userId: string,
  email: string,
  window: AppWindow,
): Promise<AppSnapshot> {
  const ctx = await resolveWindowContext(userId, window);
  const [workouts, metricsByWorkoutId, zonesByWorkoutId, derivedRows] = await Promise.all([
    loadWorkoutsSlice(userId, ctx.todayDate, ctx.span),
    loadMetricsSlice(userId, ctx.todayDate, ctx.span),
    loadZonesSlice(userId, ctx.todayDate, ctx.span),
    loadDerivedSlice(userId, ctx.todayDate, ctx.span),
  ]);
  const { allWorkouts, workouts: windowWorkouts } = filterWorkouts(
    workouts,
    ctx.windowSince,
    window.focusRun,
  );
  const derived = derivedPack(derivedRows, ctx.todayDate, ctx.windowSince);
  const snapshot = baseSnap(userId, email, window, ctx);
  snapshot.workouts = windowWorkouts;
  snapshot.allWorkouts = allWorkouts;
  snapshot.metricsByWorkoutId = metricsByWorkoutId;
  snapshot.zonesByWorkoutId = zonesByWorkoutId;
  snapshot.derivedGateByDate = derived.derivedGateByDate;
  return snapshot;
}

export async function loadBodyPageData(userId: string, window: AppWindow): Promise<BodyPageData> {
  const ctx = await resolveWindowContext(userId, window);
  const [dailyHistory, capacity] = await Promise.all([
    loadDailySlice(userId, ctx.todayDate, ctx.span),
    loadCapacitySlice(userId, ctx.todayDate, ctx.span),
  ]);
  return {
    todayDate: ctx.todayDate,
    dailyHistory,
    capacity: capacity.map((c) => ({ date: c.date, vo2max_running: c.vo2max_running })),
  };
}

export async function loadHealthPageData(userId: string): Promise<HealthPageData> {
  const timezone = await loadTimezone(userId);
  const todayDate = localDateInTz(new Date(), timezone);
  const [events, docs] = await Promise.all([
    loadEventsSlice(userId),
    loadDocContents(userId, ["HEALTH_LOG.md"]),
  ]);
  return {
    todayDate,
    events,
    healthLog: docs["HEALTH_LOG.md"] ?? null,
  };
}

export type AnalyzeSliceNeeds = {
  workouts: boolean;
  metrics: boolean;
  zones: boolean;
  daily: boolean;
  derived: boolean;
  events: boolean;
  capacity: boolean;
  goals: boolean;
  thresholds: boolean;
  insight: boolean;
};

export function analyzeSliceNeeds(tab: AnalyzeTab): AnalyzeSliceNeeds {
  return {
    workouts: tab !== "stats",
    metrics: tab === "build" || tab === "long-run" || tab === "form" || tab === "recovery",
    zones: tab === "intensity" || tab === "recovery",
    daily: tab === "recovery" || tab === "stats",
    derived: tab === "recovery",
    events: tab === "form",
    capacity: tab === "fitness",
    goals: tab === "fitness",
    thresholds: tab === "fitness",
    insight: tab === "build",
  };
}

export async function loadAnalyzeSnapshot(
  userId: string,
  email: string,
  window: AppWindow,
  tab: AnalyzeTab,
): Promise<AppSnapshot> {
  const ctx = await resolveWindowContext(userId, window);
  const need = analyzeSliceNeeds(tab);
  const [
    workouts,
    metricsByWorkoutId,
    zonesByWorkoutId,
    dailyRows,
    derivedRows,
    events,
    capacity,
    insightPath,
  ] = await Promise.all([
    need.workouts ? loadWorkoutsSlice(userId, ctx.todayDate, ctx.span) : Promise.resolve([]),
    need.metrics ? loadMetricsSlice(userId, ctx.todayDate, ctx.span) : Promise.resolve({}),
    need.zones ? loadZonesSlice(userId, ctx.todayDate, ctx.span) : Promise.resolve({}),
    need.daily ? loadDailySlice(userId, ctx.todayDate, ctx.span) : Promise.resolve([]),
    need.derived ? loadDerivedSlice(userId, ctx.todayDate, ctx.span) : Promise.resolve([]),
    need.events ? loadEventsSlice(userId) : Promise.resolve([]),
    need.capacity ? loadCapacitySlice(userId, ctx.todayDate, ctx.span) : Promise.resolve([]),
    need.insight ? loadLatestPath(userId, "insights/") : Promise.resolve(null),
  ]);
  const docPaths = [
    ...(need.goals ? ["GOALS.md"] : []),
    ...(need.thresholds ? ["THRESHOLDS.md"] : []),
    ...(insightPath ? [insightPath] : []),
  ];
  const content = docPaths.length ? await loadDocContents(userId, docPaths) : {};
  const { allWorkouts, workouts: windowWorkouts } = filterWorkouts(
    workouts,
    ctx.windowSince,
    window.focusRun,
  );
  const daily = dailyPack(dailyRows, ctx.todayDate, ctx.windowSince);
  const derived = derivedPack(derivedRows, ctx.todayDate, ctx.windowSince);
  const snapshot = baseSnap(userId, email, window, ctx);
  snapshot.workouts = windowWorkouts;
  snapshot.allWorkouts = allWorkouts;
  snapshot.metricsByWorkoutId = metricsByWorkoutId;
  snapshot.zonesByWorkoutId = zonesByWorkoutId;
  snapshot.daily = daily.daily;
  snapshot.dailyHistory = daily.dailyHistory;
  snapshot.race = need.goals ? raceFromGoals(content["GOALS.md"] ?? "", ctx.todayDate) : null;
  snapshot.thresholds = need.thresholds ? thresholdsFromDoc(content["THRESHOLDS.md"]) : null;
  snapshot.latestInsightPath = insightPath;
  return snapshot;
}
