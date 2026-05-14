import Link from "next/link";
import { Calendar } from "@/components/data/calendar";
import { Documents } from "@/components/data/documents";
import { EmptyDataState } from "@/components/data/empty-state";
import { PrincipleCheck } from "@/components/data/principle-check";
import { RaceHero } from "@/components/data/race-hero";
import { Timeline } from "@/components/data/timeline";
import { Trends } from "@/components/data/trends";
import { hoursByType } from "@/lib/data-display/aggregate";
import { computeBaseline } from "@/lib/data-display/baseline";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ days?: string; view?: string; nogolf?: string }>;

type ViewKey = "timeline" | "calendar" | "trends";

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
  const days = parseDays(params.days);
  const view = parseView(params.view);
  const trainingOnly = params.nogolf === "1";

  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - days + 1);
  const sinceDate = since.toISOString().slice(0, 10);
  const sinceIso = since.toISOString();

  const sb = adminClient();
  const [workouts, daily, meals, healthRecent, healthOpenOlder, documents] = await Promise.all([
    sb
      .from("workouts")
      .select(
        "id, date, type, duration_min, distance_km, avg_hr, max_hr, rpe, shoes, source, notes",
      )
      .eq("user_id", user.id)
      .gte("date", sinceDate)
      .order("date", { ascending: false }),
    sb
      .from("daily_entries")
      .select(
        "id, date, sleep_h, sleep_deep_min, sleep_light_min, sleep_rem_min, sleep_awake_min, hrv_ms, rhr_bpm, spo2_avg_pct, respiration_avg_brpm, weight_kg, body_fat_pct, steps, active_calories, floors_climbed, intensity_min_moderate, intensity_min_vigorous, fatigue, soreness, mood, stress, motivation, sleep_quality, sleep_notes, wellness_notes, meal_notes",
      )
      .eq("user_id", user.id)
      .gte("date", sinceDate)
      .order("date", { ascending: false }),
    sb
      .from("meals")
      .select(
        "id, eaten_at, meal_type, description, calories, protein_g, carbs_g, fat_g, fiber_g, notes, source",
      )
      .eq("user_id", user.id)
      .gte("eaten_at", sinceIso)
      .order("eaten_at", { ascending: false }),
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
    sb
      .from("documents")
      .select("path, content, updated_at")
      .eq("user_id", user.id)
      .order("path", { ascending: true }),
  ]);

  for (const r of [workouts, daily, meals, healthRecent, healthOpenOlder, documents]) {
    if (r.error) throw new Error(r.error.message);
  }

  type EventRow = Parameters<typeof Timeline>[0]["events"][number];
  const events = mergeEvents(
    (healthRecent.data ?? []) as EventRow[],
    (healthOpenOlder.data ?? []) as EventRow[],
  );

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

  const workoutMix = hoursByType(filteredWorkouts, 3);

  const counts = {
    workouts: filteredWorkouts.length,
    daily: (daily.data ?? []).length,
    meals: (meals.data ?? []).length,
    events: events.length,
  };

  const hasAnyData =
    counts.workouts > 0 ||
    counts.daily > 0 ||
    counts.meals > 0 ||
    counts.events > 0;

  if (!hasAnyData) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <EmptyDataState email={user.email ?? ""} />
      </div>
    );
  }

  const docs = (documents.data ?? []) as Array<{
    path: string;
    content: string;
    updated_at: string;
  }>;
  const goalsDoc = docs.find((d) => d.path === "GOALS.md")?.content ?? "";
  const currentDoc = docs.find((d) => d.path === "CURRENT.md")?.content ?? "";
  const principlesDoc = docs.find((d) => d.path === "PRINCIPLES.md")?.content ?? "";

  const dailyRows = (daily.data ?? []) as Array<{
    date: string;
    hrv_ms: number | null;
    rhr_bpm: number | null;
  }>;
  const hrvBaseline = computeBaseline(dailyRows.map((d) => d.hrv_ms));
  const rhrBaseline = computeBaseline(dailyRows.map((d) => d.rhr_bpm));
  const yesterdayIso = (() => {
    const y = new Date(today);
    y.setUTCDate(y.getUTCDate() - 1);
    return y.toISOString().slice(0, 10);
  })();
  const yesterdayHighestRpe = filteredWorkouts
    .filter((w) => w.date === yesterdayIso && w.rpe != null)
    .reduce<number | null>((m, w) => Math.max(m ?? 0, w.rpe ?? 0) || null, null);
  const latestHrv = dailyRows.find((d) => d.hrv_ms != null)?.hrv_ms ?? null;
  const latestRhr = dailyRows.find((d) => d.rhr_bpm != null)?.rhr_bpm ?? null;
  const principleCtx = {
    yesterdayHighestRpe,
    hrvBelowBaseline:
      latestHrv != null && hrvBaseline != null && latestHrv < hrvBaseline.mean - hrvBaseline.sd,
    rhrAboveBaseline:
      latestRhr != null && rhrBaseline != null && latestRhr > rhrBaseline.mean + rhrBaseline.sd,
    activeHealthEvent: events.some((e) => !e.resolved_date),
  };

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <RaceHero
        goalsContent={goalsDoc}
        currentContent={currentDoc}
        today={todayDate}
      />

      <header className="mt-6 flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything Body Intelligence has captured — day-by-day on the
            Timeline, by month on the Calendar, summarized over time in Trends.
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
        />
      </header>

      <div className="mt-6">
        {view === "timeline" ? (
          <Timeline
            workouts={filteredWorkouts as Parameters<typeof Timeline>[0]["workouts"]}
            daily={(daily.data ?? []) as Parameters<typeof Timeline>[0]["daily"]}
            meals={(meals.data ?? []) as Parameters<typeof Timeline>[0]["meals"]}
            events={events}
          />
        ) : view === "calendar" ? (
          <Calendar
            workouts={filteredWorkouts as Parameters<typeof Calendar>[0]["workouts"]}
            daily={(daily.data ?? []) as Parameters<typeof Calendar>[0]["daily"]}
            meals={(meals.data ?? []) as Parameters<typeof Calendar>[0]["meals"]}
            events={(healthRecent.data ?? []) as Parameters<typeof Calendar>[0]["events"]}
            startDate={sinceDate}
            endDate={todayDate}
          />
        ) : (
          <Trends
            daily={(daily.data ?? []) as Parameters<typeof Trends>[0]["daily"]}
            workouts={filteredWorkouts as Parameters<typeof Trends>[0]["workouts"]}
            meals={(meals.data ?? []) as Parameters<typeof Trends>[0]["meals"]}
            startDate={sinceDate}
            endDate={todayDate}
          />
        )}
      </div>

      <section className="mt-8">
        <PrincipleCheck principlesContent={principlesDoc} ctx={principleCtx} />
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Memory documents</h2>
          <span className="text-xs text-muted-foreground">
            Markdown notes Claude reads as context — independent of the window above
          </span>
        </div>
        <Documents rows={(documents.data ?? []) as Parameters<typeof Documents>[0]["rows"]} />
      </section>
    </div>
  );
}

function Tabs({ current, days }: { current: ViewKey; days: number }) {
  const tabs: Array<{ key: ViewKey; label: string }> = [
    { key: "timeline", label: "Timeline" },
    { key: "calendar", label: "Calendar" },
    { key: "trends", label: "Trends" },
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
}: {
  counts: { workouts: number; daily: number; meals: number; events: number };
  days: number;
  workoutMix: { entries: Array<{ type: string; hours: number }>; totalHours: number };
  trainingOnly: boolean;
  view: ViewKey;
}) {
  const workoutSub =
    workoutMix.totalHours > 0
      ? workoutMix.entries
          .map((e) => `${capitalize(e.type)} ${formatHours(e.hours)}h`)
          .join(" · ")
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
      n: workoutMix.totalHours > 0 ? formatHours(workoutMix.totalHours) : counts.workouts,
      sub: workoutSub,
      accent: "bg-sky-500/70",
    },
    {
      label: "Daily check-ins",
      n: counts.daily,
      sub: `${pct(counts.daily, days)}% of days`,
      accent: "bg-emerald-500/70",
    },
    {
      label: "Meals",
      n: counts.meals,
      sub: perDay(counts.meals, days),
      accent: "bg-amber-500/70",
    },
    {
      label: "Health events",
      n: counts.events,
      sub: counts.events === 0 ? "none active" : "in view",
      accent: counts.events === 0 ? "bg-foreground/30" : "bg-rose-500/70",
    },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

function parseDays(raw: string | undefined): number {
  const n = Number(raw ?? "30");
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(365, Math.floor(n)));
}

function parseView(raw: string | undefined): ViewKey {
  if (raw === "trends") return "trends";
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

function perWeek(n: number, days: number): string {
  if (days <= 0) return "—";
  const per = (n / days) * 7;
  return `${per.toFixed(per >= 10 ? 0 : 1)} / wk`;
}

function perDay(n: number, days: number): string {
  if (days <= 0 || n === 0) return n === 0 ? "—" : "—";
  const per = n / days;
  return `${per.toFixed(per >= 10 ? 0 : 1)} / day`;
}

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((n / total) * 100));
}
