import Link from "next/link";
import { BriefingsFeed } from "@/components/data/briefings-feed";
import { Calendar } from "@/components/data/calendar";
import { Documents } from "@/components/data/documents";
import { EmptyDataState } from "@/components/data/empty-state";
import { HealthThreads } from "@/components/data/health-threads";
import { Timeline } from "@/components/data/timeline";
import { TodayHero } from "@/components/data/today-hero";
import { Analyze } from "@/components/data/analyze";
import { hoursByType } from "@/lib/data-display/aggregate";
import { computeBaseline } from "@/lib/data-display/baseline";
import { NON_ENDURANCE_LOAD_TYPES } from "@/lib/data-display/metric-series";
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
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ days?: string; view?: string; nogolf?: string }>;

type ViewKey = "timeline" | "calendar" | "analyze";

// Full workout_metrics row as selected below — a superset of what Timeline
// (WorkoutMetricsRow) and Trends (TrendsWorkoutMetric) each consume.
type WorkoutMetricsFull = {
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
};

const WINDOWS = [7, 30, 90, 365] as const;

export default async function DataPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Auth is enforced by the parent layout — no need to re-check here.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout guarantees this, but TS narrowing wants it.
  if (!user) return null;

  const params = await searchParams;
  const view = parseView(params.view);
  // Analyze leans on wider windows for steadier statistics, so default it to 90d
  // when the user hasn't picked a range explicitly.
  const days = parseDays(params.days, view === "analyze" ? 90 : 30);
  const trainingOnly = params.nogolf === "1";

  // Resolve "today" in the user's timezone (profile default Europe/Oslo
  // when set) rather than UTC, so the day grouping / streak / hero gate
  // don't roll over at the wrong hour.
  const profile = await sb_profileTimezone(user.id);
  const todayDate = localDateInTz(new Date(), profile.timezone);
  const sinceDate = addDays(todayDate, -(days - 1));

  const sb = adminClient();
  const [
    workouts,
    daily,
    healthRecent,
    healthOpenOlder,
    documents,
    derivedRows,
    metricsRows,
    eventUpdates,
    installed,
    milestones,
  ] = await Promise.all([
    sb
      .from("workouts")
      .select(
        "id, date, type, duration_min, distance_km, avg_hr, max_hr, rpe, shoes, source, notes",
      )
      .eq("user_id", user.id)
      .gte("date", sinceDate)
      .order("date", { ascending: false }),
    // Core columns only — the derived-layer migration's additive columns
    // (skin_temp_deviation_c, sleep_score, health_events.next_milestone*)
    // are fetched separately in the tolerant batch so a deploy that lands
    // before the migration doesn't 500 the whole dashboard.
    sb
      .from("daily_entries")
      .select(
        "id, date, sleep_h, sleep_deep_min, sleep_light_min, sleep_rem_min, sleep_awake_min, hrv_ms, rhr_bpm, spo2_avg_pct, respiration_avg_brpm, weight_kg, body_fat_pct, steps, active_calories, floors_climbed, intensity_min_moderate, intensity_min_vigorous, fatigue, soreness, mood, stress, motivation, sleep_quality, sleep_notes, wellness_notes, meal_notes",
      )
      .eq("user_id", user.id)
      .gte("date", sinceDate)
      .order("date", { ascending: false }),
    sb
      .from("health_events")
      .select("id, date, kind, body_part, severity, notes, resolved_date")
      .eq("user_id", user.id)
      .gte("date", sinceDate)
      .order("date", { ascending: false }),
    sb
      .from("health_events")
      .select("id, date, kind, body_part, severity, notes, resolved_date")
      .eq("user_id", user.id)
      .lt("date", sinceDate)
      .is("resolved_date", null)
      .order("date", { ascending: false }),
    // Only path + updated_at for every doc; full content just for the
    // standard top-level files and the few briefings the feed shows.
    sb
      .from("documents")
      .select("path, updated_at")
      .eq("user_id", user.id)
      .order("path", { ascending: true }),
    sb
      .from("derived_daily")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", sinceDate)
      .order("date", { ascending: false }),
    sb
      .from("workout_metrics")
      .select(
        "workout_id, date, cadence_spm, gct_ms, gct_balance_pct_left, vertical_oscillation_mm, vertical_ratio_pct, stride_len_m, te_aerobic, te_anaerobic, vendor_training_load, stamina_start_pct, stamina_end_pct, stamina_min_pct, decoupling_pct, elevation_gain_m, elevation_loss_m, avg_speed_kmh, max_speed_kmh",
      )
      .eq("user_id", user.id)
      .gte("date", sinceDate),
    sb
      .from("health_event_updates")
      .select("event_id, date, note, severity_at_time")
      .eq("user_id", user.id)
      .order("date", { ascending: true }),
    sb
      .from("installed_recipes")
      .select("recipe_id")
      .eq("user_id", user.id),
    // Milestone columns isolated here so a missing column (pre-migration)
    // degrades to "no milestones" rather than failing the core event query.
    sb
      .from("health_events")
      .select("id, next_milestone, next_milestone_date")
      .eq("user_id", user.id)
      .not("next_milestone", "is", null),
  ]);

  // Core entities must succeed.
  for (const r of [workouts, daily, healthRecent, healthOpenOlder, documents, installed]) {
    if (r.error) throw new Error(r.error.message);
  }
  // The derived layer is additive: if its migration hasn't landed yet (the
  // window between a code deploy and the migrate workflow), degrade to empty
  // instead of crashing the whole dashboard. Re-throw any other error.
  for (const r of [derivedRows, metricsRows, eventUpdates, milestones]) {
    if (r.error && !isMissingRelation(r.error)) throw new Error(r.error.message);
  }

  // The latest derived row drives the hero gate (may be today's or older —
  // the hero's freshness ladder handles staleness).
  const derived = (derivedRows.data ?? []) as DerivedDailyRow[];
  const derivedGateByDate: Record<string, Gate> = {};
  for (const d of derived) {
    if (d.readiness_gate) derivedGateByDate[d.date] = d.readiness_gate;
  }

  const metrics = (metricsRows.data ?? []) as Array<WorkoutMetricsFull>;
  const metricsByWorkoutId: Record<string, WorkoutMetricsFull> = {};
  for (const m of metrics) metricsByWorkoutId[m.workout_id] = m;

  // Thread updates grouped per event.
  const updatesByEvent = new Map<string, HealthEventUpdate[]>();
  for (const u of (eventUpdates.data ?? []) as Array<
    { event_id: string } & HealthEventUpdate
  >) {
    const arr = updatesByEvent.get(u.event_id);
    const entry: HealthEventUpdate = {
      date: u.date,
      note: u.note,
      severity_at_time: u.severity_at_time,
    };
    if (arr) arr.push(entry);
    else updatesByEvent.set(u.event_id, [entry]);
  }

  type RawEvent = {
    id: string;
    date: string;
    kind: string;
    body_part: string | null;
    severity: number | null;
    notes: string | null;
    resolved_date: string | null;
  };
  const milestoneByEvent = new Map(
    ((milestones.data ?? []) as Array<{
      id: string;
      next_milestone: string | null;
      next_milestone_date: string | null;
    }>).map((m) => [m.id, m] as const),
  );
  const rawEvents = mergeEvents(
    (healthRecent.data ?? []) as RawEvent[],
    (healthOpenOlder.data ?? []) as RawEvent[],
  );
  const events: ThreadedHealthEvent[] = rawEvents.map((e) => ({
    ...e,
    next_milestone: milestoneByEvent.get(e.id)?.next_milestone ?? null,
    next_milestone_date: milestoneByEvent.get(e.id)?.next_milestone_date ?? null,
    updates: updatesByEvent.get(e.id) ?? [],
  }));

  const allWorkouts = (workouts.data ?? []) as Array<{
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
  }>;
  // "Training-only" filter: drop golf and very short sessions when ?nogolf=1.
  const filteredWorkouts = trainingOnly
    ? allWorkouts.filter(
        (w) => w.type.trim().toLowerCase() !== "golf" && (w.duration_min ?? 0) >= 15,
      )
    : allWorkouts;

  // Split non-endurance types (golf/walk/…) out of the training-hours headline
  // so it reflects the same set that feeds training load — golf counting as
  // "training hours" but not load was inconsistent framing.
  const workoutMix = hoursByType(filteredWorkouts, 3, NON_ENDURANCE_LOAD_TYPES);

  const counts = {
    workouts: filteredWorkouts.length,
    daily: (daily.data ?? []).length,
    events: events.filter((e) => !e.resolved_date).length,
  };

  // Quick daily-entry streak — computed from rows we already fetched.
  const dailyDates = new Set(
    (daily.data ?? []).map((d) => (d as { date: string }).date),
  );
  const dailyStreak = (() => {
    let n = 0;
    let cursor = todayDate;
    while (dailyDates.has(cursor)) {
      n++;
      cursor = addDays(cursor, -1);
    }
    return n;
  })();

  const hasAnyData =
    counts.workouts > 0 || counts.daily > 0 || events.length > 0;

  if (!hasAnyData) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <EmptyDataState email={user.email ?? ""} />
      </div>
    );
  }

  // ---- Memory documents: slim listing + targeted content fetch ----
  const docMeta = (documents.data ?? []) as Array<{
    path: string;
    updated_at: string;
  }>;
  const STANDARD = new Set([
    "MEMORY.md",
    "PROFILE.md",
    "PRINCIPLES.md",
    "GOALS.md",
    "CURRENT.md",
    "HEALTH_LOG.md",
    "NUTRITION.md",
    "EQUIPMENT.md",
    "BASELINES.md",
    "THRESHOLDS.md",
    "RECORDS.md",
  ]);
  const briefingMeta = docMeta
    .filter((d) => d.path.startsWith("briefings/"))
    .sort((a, b) => b.path.localeCompare(a.path));
  const latestBriefingPath = briefingMeta[0]?.path ?? null;
  const insightsMeta = docMeta
    .filter((d) => d.path.startsWith("insights/"))
    .sort((a, b) => b.path.localeCompare(a.path));
  const latestInsightPath = insightsMeta[0]?.path ?? null;
  // Full content only for standard docs + the latest briefing + latest insight.
  const contentPaths = [
    ...docMeta.filter((d) => STANDARD.has(d.path)).map((d) => d.path),
    ...(latestBriefingPath ? [latestBriefingPath] : []),
    ...(latestInsightPath ? [latestInsightPath] : []),
  ];
  const contentRows = contentPaths.length
    ? await sb
        .from("documents")
        .select("path, content")
        .eq("user_id", user.id)
        .in("path", contentPaths)
    : { data: [], error: null };
  if (contentRows.error) throw new Error(contentRows.error.message);
  const contentByPath = new Map(
    ((contentRows.data ?? []) as Array<{ path: string; content: string }>).map(
      (r) => [r.path, r.content] as const,
    ),
  );

  const docRows = docMeta.map((d) => ({
    path: d.path,
    updated_at: d.updated_at,
    content: contentByPath.get(d.path) ?? null,
  }));

  const goalsDoc = contentByPath.get("GOALS.md") ?? "";
  const races = parseGoalsMarkdown(goalsDoc);
  const targetRace = nextRace(races, todayDate);
  const raceInfo = targetRace
    ? {
        name: targetRace.name,
        date: targetRace.date,
        daysOut: daysUntil(targetRace.date, todayDate),
      }
    : null;
  // Join the A-race goal to its capacity prediction for the Analyze race-
  // readiness panel (null when the goal/distance can't be parsed).
  const raceReadiness = (() => {
    if (!targetRace) return null;
    const predKey = racePredictionKey(targetRace.distance);
    const goalSeconds = parseGoalSeconds(targetRace.goal);
    if (!predKey || goalSeconds == null) return null;
    return {
      predKey,
      goalSeconds,
      daysOut: daysUntil(targetRace.date, todayDate),
      label: targetRace.name,
    };
  })();

  // Briefings feed: latest with content, the rest as metadata rows.
  const briefings = briefingMeta.map((d) => ({
    path: d.path,
    date: d.path.replace(/^briefings\//, "").replace(/\.md$/, ""),
    updated_at: d.updated_at,
    content: d.path === latestBriefingPath ? (contentByPath.get(d.path) ?? null) : null,
  }));

  // Insights feed (rendered atop the Analyze view): Claude-authored
  // interpretation docs under insights/. Latest carries content.
  const insights = insightsMeta.map((d) => ({
    path: d.path,
    label: d.path.replace(/^insights\//, "").replace(/\.md$/, ""),
    updated_at: d.updated_at,
    content: d.path === latestInsightPath ? (contentByPath.get(d.path) ?? null) : null,
  }));

  // ---- Hero inputs ----
  const dailyRowsAll = (daily.data ?? []) as Array<{
    date: string;
    sleep_h: string | null;
    hrv_ms: number | null;
    rhr_bpm: number | null;
  }>;
  const hrvBaseline = computeBaseline(dailyRowsAll.map((d) => d.hrv_ms));
  const rhrBaseline = computeBaseline(dailyRowsAll.map((d) => d.rhr_bpm));
  const sleepBaseline = computeBaseline(
    dailyRowsAll.map((d) => (d.sleep_h == null ? null : Number(d.sleep_h))),
  );
  const latest = dailyRowsAll[0];
  const latestVitals = {
    sleepH: latest?.sleep_h != null ? Number(latest.sleep_h) : null,
    hrvMs: latest?.hrv_ms ?? null,
    rhrBpm: latest?.rhr_bpm ?? null,
    hrvBaseline,
    rhrBaseline,
    sleepBaseline,
  };

  // Active-event milestone soonest in the future drives the hero chip.
  const milestone = (() => {
    const candidates = events
      .filter((e) => !e.resolved_date && e.next_milestone && e.next_milestone_date)
      .map((e) => ({
        label: e.next_milestone!,
        date: e.next_milestone_date!,
        daysOut: daysUntil(e.next_milestone_date!, todayDate),
      }))
      // Keep overdue checkpoints (negative daysOut) and surface them first — an
      // overdue MRI is the most important thing to flag, not something to hide.
      .sort((a, b) => a.daysOut - b.daysOut);
    return candidates[0] ?? null;
  })();

  // 14-day gate history strip for the hero.
  const gateHistory = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(todayDate, -(13 - i));
    return { date, gate: derivedGateByDate[date] ?? null };
  });

  const installedIds = new Set(
    ((installed.data ?? []) as Array<{ recipe_id: string }>).map(
      (r) => r.recipe_id,
    ),
  );

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <TodayHero
        todayDate={todayDate}
        derived={derived[0] ?? null}
        briefingPath={
          briefingMeta.find((b) => b.path === `briefings/${todayDate}.md`)?.path ??
          latestBriefingPath
        }
        briefingContent={
          latestBriefingPath ? (contentByPath.get(latestBriefingPath) ?? null) : null
        }
        vitals={latestVitals}
        race={raceInfo}
        milestone={milestone}
        gateHistory={gateHistory}
        hasDawnAgent={installedIds.has("dawn-agent")}
        variant={view === "analyze" ? "compact" : "full"}
      />

      {/* Health threads sit above the fold in Timeline/Calendar, but in Analyze
          they move below the charts so the analytics start near the top. */}
      {view !== "analyze" && events.some((e) => !e.resolved_date) ? (
        <section className="mt-6">
          <HealthThreads events={events} todayDate={todayDate} />
        </section>
      ) : null}

      <header className="mt-8 flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything Body Intelligence has captured — day-by-day on the
            Timeline, by month on the Calendar, analyzed statistically in Analyze.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs current={view} days={days} />
          <WindowPicker days={days} view={view} />
        </div>

        <SummaryStrip
          counts={counts}
          days={days}
          workoutMix={workoutMix}
          trainingOnly={trainingOnly}
          view={view}
          dailyStreak={dailyStreak}
        />
      </header>

      <div className="mt-6">
        {view === "timeline" ? (
          <Timeline
            workouts={filteredWorkouts as Parameters<typeof Timeline>[0]["workouts"]}
            daily={(daily.data ?? []) as Parameters<typeof Timeline>[0]["daily"]}
            events={events}
            todayDate={todayDate}
            derivedGateByDate={derivedGateByDate}
            metricsByWorkoutId={
              metricsByWorkoutId as Parameters<typeof Timeline>[0]["metricsByWorkoutId"]
            }
          />
        ) : view === "calendar" ? (
          <Calendar
            workouts={filteredWorkouts as Parameters<typeof Calendar>[0]["workouts"]}
            daily={(daily.data ?? []) as Parameters<typeof Calendar>[0]["daily"]}
            events={(healthRecent.data ?? []) as Parameters<typeof Calendar>[0]["events"]}
            derivedGateByDate={derivedGateByDate}
            startDate={sinceDate}
            endDate={todayDate}
          />
        ) : (
          <Analyze
            userId={user.id}
            days={days}
            insights={insights}
            raceReadiness={raceReadiness}
            daily={(daily.data ?? []) as Parameters<typeof Analyze>[0]["daily"]}
            workouts={filteredWorkouts as Parameters<typeof Analyze>[0]["workouts"]}
            derived={derived}
            workoutMetrics={
              metrics as Parameters<typeof Analyze>[0]["workoutMetrics"]
            }
            startDate={sinceDate}
            endDate={todayDate}
          />
        )}
      </div>

      {view === "analyze" && events.some((e) => !e.resolved_date) ? (
        <section className="mt-10">
          <HealthThreads events={events} todayDate={todayDate} />
        </section>
      ) : null}

      <section className="mt-10">
        <BriefingsFeed briefings={briefings} />
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Memory documents</h2>
          <span className="text-xs text-muted-foreground">
            Markdown notes Claude reads as context — independent of the window above
          </span>
        </div>
        <Documents
          rows={docRows as Parameters<typeof Documents>[0]["rows"]}
          excludeFolders={["briefings/", "insights/"]}
        />
      </section>
    </div>
  );
}

// A Postgres "relation/column does not exist" or PostgREST schema-cache miss,
// from a query against a table whose migration hasn't applied yet.
function isMissingRelation(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST205") {
    return true;
  }
  const m = error.message ?? "";
  return /does not exist|schema cache/i.test(m);
}

async function sb_profileTimezone(userId: string): Promise<{ timezone: string }> {
  const sb = adminClient();
  const { data } = await sb
    .from("user_profiles")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();
  const tz = (data as { timezone?: string } | null)?.timezone;
  return { timezone: tz && tz !== "UTC" ? tz : "Europe/Oslo" };
}

// Local calendar date (YYYY-MM-DD) for an instant in a given IANA timezone.
function localDateInTz(instant: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function Tabs({ current, days }: { current: ViewKey; days: number }) {
  const tabs: Array<{ key: ViewKey; label: string }> = [
    { key: "timeline", label: "Timeline" },
    { key: "calendar", label: "Calendar" },
    { key: "analyze", label: "Analyze" },
  ];
  return (
    <nav className="inline-flex rounded-lg border bg-muted/30 p-1 text-sm">
      {tabs.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={`?view=${t.key}&days=${days}`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function WindowPicker({ days, view }: { days: number; view: ViewKey }) {
  return (
    <div
      role="group"
      aria-label="Time range"
      className="flex items-center gap-1 text-xs"
    >
      <span className="mr-1 text-muted-foreground">Range</span>
      {WINDOWS.map((d) => {
        const active = d === days;
        return (
          <Link
            key={d}
            href={`?view=${view}&days=${d}`}
            aria-current={active ? "true" : undefined}
            className={`rounded-md border px-2 py-1 transition-colors ${
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {d === 365 ? "1y" : `${d}d`}
          </Link>
        );
      })}
    </div>
  );
}

function SummaryStrip({
  counts,
  days,
  workoutMix,
  trainingOnly,
  view,
  dailyStreak,
}: {
  counts: { workouts: number; daily: number; events: number };
  days: number;
  workoutMix: {
    entries: Array<{ type: string; hours: number }>;
    totalHours: number;
    excludedEntries: Array<{ type: string; hours: number }>;
    excludedHours: number;
  };
  trainingOnly: boolean;
  view: ViewKey;
  dailyStreak: number;
}) {
  // The excluded (non-endurance) hours are shown as a separate suffix so golf
  // is visible without inflating the training-hours count.
  const excludedSuffix =
    workoutMix.excludedHours > 0
      ? ` · +${workoutMix.excludedEntries
          .map((e) => `${capitalize(e.type)} ${formatHours(e.hours)}h`)
          .join(" ")} (excl.)`
      : "";
  const workoutSub =
    workoutMix.totalHours > 0
      ? `${workoutMix.entries
          .map((e) => `${capitalize(e.type)} ${formatHours(e.hours)}h`)
          .join(" · ")}${excludedSuffix}`
      : workoutMix.excludedHours > 0
        ? `${formatHours(workoutMix.excludedHours)}h non-endurance only`
        : counts.workouts === 0
          ? "none in view"
          : `${counts.workouts} session${counts.workouts === 1 ? "" : "s"}`;
  const items: Array<{
    label: string;
    n: string | number;
    sub: string;
    accent: string;
  }> = [
    {
      label: "Training hours",
      n:
        workoutMix.totalHours > 0
          ? formatHours(workoutMix.totalHours)
          : workoutMix.excludedHours > 0
            ? 0
            : counts.workouts,
      sub: workoutSub,
      accent: "bg-sky-500/70",
    },
    {
      label: "Daily check-ins",
      n: counts.daily,
      sub:
        dailyStreak > 0
          ? `${pct(counts.daily, days)}% · streak ${dailyStreak}d`
          : `${pct(counts.daily, days)}% of days · no streak`,
      accent: "bg-emerald-500/70",
    },
    {
      label: "Health events",
      n: counts.events,
      sub: counts.events === 0 ? "none active" : "active",
      accent: counts.events === 0 ? "bg-foreground/30" : "bg-rose-500/70",
    },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-3">
        {items.map((i) => (
          <div
            key={i.label}
            className="relative overflow-hidden rounded-xl border bg-card px-3 py-2.5 shadow-sm"
          >
            <span aria-hidden className={`absolute left-0 top-0 h-full w-[3px] ${i.accent}`} />
            <div className="pl-1">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {i.label}
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="font-mono text-xl tabular-nums">{i.n}</span>
                <span className="line-clamp-1 text-[10px] text-muted-foreground">
                  {i.sub}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
        <Link
          href={`?view=${view}&days=${days}${trainingOnly ? "" : "&nogolf=1"}`}
          className={`rounded-md border px-2 py-0.5 transition-colors ${
            trainingOnly
              ? "border-foreground bg-foreground text-background"
              : "border-border hover:bg-muted hover:text-foreground"
          }`}
        >
          {trainingOnly ? "Showing training-only (exclude golf & <15m)" : "Show training-only"}
        </Link>
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatHours(h: number): string {
  if (h >= 10) return Math.round(h).toString();
  return h.toFixed(1);
}

function parseDays(raw: string | undefined, fallback = 30): number {
  if (raw == null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(365, Math.floor(n)));
}

function parseView(raw: string | undefined): ViewKey {
  // "trends" is kept as an alias so existing bookmarks/links don't 404.
  if (raw === "analyze" || raw === "trends") return "analyze";
  if (raw === "calendar") return "calendar";
  return "timeline";
}

function mergeEvents<T extends { id: string }>(a: T[], b: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of [...a, ...b]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((n / total) * 100));
}
