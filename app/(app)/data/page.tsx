import Link from "next/link";
import { redirect } from "next/navigation";
import { Documents } from "@/components/data/documents";
import { Timeline } from "@/components/data/timeline";
import { Trends } from "@/components/data/trends";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ days?: string; view?: string }>;

type ViewKey = "timeline" | "trends";

const WINDOWS = [7, 30, 90, 365] as const;

export default async function DataPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fdata");

  const params = await searchParams;
  const days = parseDays(params.days);
  const view = parseView(params.view);

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
        "id, date, sleep_h, hrv_ms, rhr_bpm, weight_kg, fatigue, soreness, mood, stress, motivation, sleep_quality, sleep_notes, wellness_notes, meal_notes",
      )
      .eq("user_id", user.id)
      .gte("date", sinceDate)
      .order("date", { ascending: false }),
    sb
      .from("meals")
      .select("id, eaten_at, meal_type, description, calories, protein_g, carbs_g, fat_g")
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

  const counts = {
    workouts: (workouts.data ?? []).length,
    daily: (daily.data ?? []).length,
    meals: (meals.data ?? []).length,
    events: events.length,
  };

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visual view of everything Body Intelligence has captured —{" "}
            day-by-day on the Timeline, summarized over time in Trends.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Tabs current={view} days={days} />
          <WindowPicker days={days} view={view} />
        </div>

        <SummaryStrip counts={counts} days={days} />
      </header>

      <div className="mt-6">
        {view === "timeline" ? (
          <Timeline
            workouts={(workouts.data ?? []) as Parameters<typeof Timeline>[0]["workouts"]}
            daily={(daily.data ?? []) as Parameters<typeof Timeline>[0]["daily"]}
            meals={(meals.data ?? []) as Parameters<typeof Timeline>[0]["meals"]}
            events={events}
          />
        ) : (
          <Trends
            daily={(daily.data ?? []) as Parameters<typeof Trends>[0]["daily"]}
            workouts={(workouts.data ?? []) as Parameters<typeof Trends>[0]["workouts"]}
            meals={(meals.data ?? []) as Parameters<typeof Trends>[0]["meals"]}
            startDate={sinceDate}
            endDate={todayDate}
          />
        )}
      </div>

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
    <div className="flex items-center gap-1 text-xs">
      <span className="mr-1 text-muted-foreground">Window</span>
      {WINDOWS.map((d) => {
        const active = d === days;
        return (
          <Link
            key={d}
            href={`?view=${view}&days=${d}`}
            className={`rounded-md border px-2 py-1 transition-colors ${
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {d}d
          </Link>
        );
      })}
    </div>
  );
}

function SummaryStrip({
  counts,
  days,
}: {
  counts: { workouts: number; daily: number; meals: number; events: number };
  days: number;
}) {
  const items: Array<{ label: string; n: number; sub: string }> = [
    { label: "Workouts", n: counts.workouts, sub: perWeek(counts.workouts, days) },
    { label: "Daily check-ins", n: counts.daily, sub: `${pct(counts.daily, days)}% of days` },
    { label: "Meals", n: counts.meals, sub: perDay(counts.meals, days) },
    { label: "Health events", n: counts.events, sub: counts.events === 0 ? "none active" : "in view" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl border bg-card px-3 py-2 shadow-sm">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {i.label}
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-mono text-xl tabular-nums">{i.n}</span>
            <span className="text-[10px] text-muted-foreground">{i.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function parseDays(raw: string | undefined): number {
  const n = Number(raw ?? "30");
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(365, Math.floor(n)));
}

function parseView(raw: string | undefined): ViewKey {
  return raw === "trends" ? "trends" : "timeline";
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
