import { computeBaseline, classify } from "@/lib/data-display/baseline";

export type CalendarWorkout = {
  id: string;
  date: string;
  type: string;
  duration_min: number | null;
  distance_km: string | null;
  rpe: number | null;
};

export type CalendarDaily = {
  date: string;
  sleep_h: string | null;
  hrv_ms: number | null;
  rhr_bpm: number | null;
  fatigue: number | null;
  soreness: number | null;
  mood: number | null;
  stress: number | null;
  motivation: number | null;
  sleep_quality: number | null;
};

export type CalendarMeal = {
  id: string;
  eaten_at: string;
};

export type CalendarEvent = {
  id: string;
  date: string;
  kind: string;
  body_part: string | null;
  resolved_date: string | null;
};

type Props = {
  workouts: ReadonlyArray<CalendarWorkout>;
  daily: ReadonlyArray<CalendarDaily>;
  meals: ReadonlyArray<CalendarMeal>;
  events: ReadonlyArray<CalendarEvent>;
  startDate: string;
  endDate: string;
};

export function Calendar({
  workouts,
  daily,
  meals,
  events,
  startDate,
  endDate,
}: Props) {
  const months = monthsCovering(startDate, endDate);
  if (months.length === 0) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
        No window to render.
      </div>
    );
  }

  const wellnessBaseline = computeBaseline(daily.map((d) => wellnessComposite(d)));
  const workoutsByDate = groupBy(workouts, (w) => w.date);
  const dailyByDate = new Map(daily.map((d) => [d.date, d] as const));
  const mealsByDate = groupBy(meals, (m) => m.eaten_at.slice(0, 10));
  const eventsByDate = groupBy(events, (e) => e.date);

  const todayIso = new Date().toISOString().slice(0, 10);
  const anyData =
    workouts.length > 0 || daily.length > 0 || meals.length > 0 || events.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <Legend />
      {!anyData ? (
        <div className="rounded-2xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
          No data in this window. Cells will fill in once you log workouts or
          daily check-ins.
        </div>
      ) : null}
      {months.map((m) => (
        <MonthGrid
          key={`${m.year}-${m.month}`}
          year={m.year}
          month={m.month}
          startDate={startDate}
          endDate={endDate}
          todayIso={todayIso}
          workoutsByDate={workoutsByDate}
          dailyByDate={dailyByDate}
          mealsByDate={mealsByDate}
          eventsByDate={eventsByDate}
          wellnessBaseline={wellnessBaseline}
        />
      ))}
    </div>
  );
}

function MonthGrid({
  year,
  month,
  startDate,
  endDate,
  todayIso,
  workoutsByDate,
  dailyByDate,
  mealsByDate,
  eventsByDate,
  wellnessBaseline,
}: {
  year: number;
  month: number; // 0-indexed
  startDate: string;
  endDate: string;
  todayIso: string;
  workoutsByDate: Map<string, CalendarWorkout[]>;
  dailyByDate: Map<string, CalendarDaily>;
  mealsByDate: Map<string, CalendarMeal[]>;
  eventsByDate: Map<string, CalendarEvent[]>;
  wellnessBaseline: ReturnType<typeof computeBaseline>;
}) {
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString(
    undefined,
    { year: "numeric", month: "long", timeZone: "UTC" },
  );
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  // Find the Monday on or before the 1st of the month.
  const startDow = firstOfMonth.getUTCDay(); // 0=Sun..6=Sat
  const leading = startDow === 0 ? 6 : startDow - 1;
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - leading);

  // Build until we cover the last day of the month and round up to a full week.
  const cells: Array<{ iso: string; inMonth: boolean }> = [];
  const cursor = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    const inMonth = cursor.getUTCMonth() === month;
    cells.push({ iso, inMonth });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (i >= 27 && cursor.getUTCMonth() !== month && cursor.getUTCDay() === 1) break;
  }

  const _ = daysInMonth; // referenced for clarity; cells calculation already handles bounds
  void _;

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold tracking-tight">{monthLabel}</h3>
      <div
        className="grid grid-cols-7 gap-1.5 text-xs"
        role="grid"
        aria-label={`Calendar for ${monthLabel}`}
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {cells.map((cell) => (
          <DayCell
            key={cell.iso}
            iso={cell.iso}
            inMonth={cell.inMonth}
            inWindow={cell.iso >= startDate && cell.iso <= endDate}
            isToday={cell.iso === todayIso}
            workouts={workoutsByDate.get(cell.iso) ?? []}
            daily={dailyByDate.get(cell.iso)}
            meals={mealsByDate.get(cell.iso) ?? []}
            events={eventsByDate.get(cell.iso) ?? []}
            wellnessBaseline={wellnessBaseline}
          />
        ))}
      </div>
    </section>
  );
}

function DayCell({
  iso,
  inMonth,
  inWindow,
  isToday,
  workouts,
  daily,
  meals,
  events,
  wellnessBaseline,
}: {
  iso: string;
  inMonth: boolean;
  inWindow: boolean;
  isToday: boolean;
  workouts: CalendarWorkout[];
  daily: CalendarDaily | undefined;
  meals: CalendarMeal[];
  events: CalendarEvent[];
  wellnessBaseline: ReturnType<typeof computeBaseline>;
}) {
  const dayNum = Number(iso.slice(8, 10));

  if (!inMonth) {
    return (
      <div className="aspect-square min-h-[68px] rounded-md border border-transparent" />
    );
  }
  if (!inWindow) {
    return (
      <div className="aspect-square min-h-[68px] rounded-md border border-dashed border-border/60 bg-muted/10 p-1 text-muted-foreground/40">
        <span className="font-mono text-[11px] tabular-nums">{dayNum}</span>
      </div>
    );
  }

  const wellness = wellnessComposite(daily);
  const tone = classify(wellness, wellnessBaseline, true);
  const bg = backgroundClassFor(tone.direction);

  const titleLines: string[] = [iso];
  if (daily) {
    const sleep = daily.sleep_h != null ? `${Number(daily.sleep_h).toFixed(1)}h` : "—";
    const hrv = daily.hrv_ms ?? "—";
    titleLines.push(`Sleep ${sleep} · HRV ${hrv}`);
    if (wellness != null) titleLines.push(`Wellness avg ${wellness.toFixed(2)}/5`);
  }
  if (workouts.length > 0) {
    for (const w of workouts) {
      const min = w.duration_min ? `${w.duration_min}min` : "";
      const rpe = w.rpe ? `RPE ${w.rpe}` : "";
      titleLines.push([w.type, min, rpe].filter(Boolean).join(" · "));
    }
  }
  if (meals.length > 0) titleLines.push(`${meals.length} meal${meals.length === 1 ? "" : "s"}`);
  if (events.length > 0) {
    for (const e of events) {
      titleLines.push(`${e.kind}${e.body_part ? ` · ${e.body_part}` : ""}${e.resolved_date ? "" : " (active)"}`);
    }
  }

  return (
    <div
      className={`relative flex aspect-square min-h-[68px] flex-col rounded-md border p-1 ${bg} ${
        isToday ? "ring-2 ring-foreground/40 ring-offset-1 ring-offset-background" : ""
      }`}
      title={titleLines.join("\n")}
    >
      <div className="flex items-start justify-between">
        <span
          className={`font-mono text-[11px] tabular-nums ${
            isToday ? "font-semibold text-foreground" : "text-foreground/80"
          }`}
        >
          {dayNum}
        </span>
        <div className="flex items-center gap-0.5">
          {events.some((e) => !e.resolved_date) ? (
            <span
              className="h-1.5 w-1.5 rounded-full bg-amber-500"
              aria-label="active health event"
            />
          ) : events.length > 0 ? (
            <span
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
              aria-label="resolved health event"
            />
          ) : null}
          {meals.length > 0 ? (
            <span
              className="h-1.5 w-1.5 rounded-full bg-foreground/30"
              aria-label={`${meals.length} meals logged`}
            />
          ) : null}
        </div>
      </div>

      {workouts.length > 0 ? (
        <div className="mt-1 flex flex-1 flex-col justify-end gap-0.5">
          {workouts.slice(0, 3).map((w) => (
            <WorkoutBar key={w.id} workout={w} />
          ))}
          {workouts.length > 3 ? (
            <span className="text-[9px] text-muted-foreground">
              +{workouts.length - 3} more
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WorkoutBar({ workout: w }: { workout: CalendarWorkout }) {
  const tone = intensityClass(w.rpe);
  const label = shortTypeLabel(w.type);
  return (
    <div
      className={`flex items-center gap-1 truncate rounded-sm border px-1 py-0.5 text-[9px] leading-none ${tone}`}
    >
      <span className="truncate font-medium uppercase tracking-wide">{label}</span>
      {w.duration_min != null ? (
        <span className="ml-auto font-mono tabular-nums opacity-80">
          {w.duration_min}′
        </span>
      ) : null}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
      <LegendItem swatch="bg-emerald-500/40" label="Wellness above baseline" />
      <LegendItem swatch="bg-muted" label="In baseline" />
      <LegendItem swatch="bg-amber-500/40" label="Below baseline" />
      <span className="mx-2 hidden h-3 w-px bg-border sm:inline-block" />
      <LegendItem swatch="bg-emerald-500/30 border border-emerald-500/40" label="Easy workout (RPE 1–3)" />
      <LegendItem swatch="bg-amber-500/30 border border-amber-500/40" label="Moderate (4–6)" />
      <LegendItem swatch="bg-rose-500/30 border border-rose-500/40" label="Hard (7–10)" />
      <span className="mx-2 hidden h-3 w-px bg-border sm:inline-block" />
      <LegendItem swatch="rounded-full h-1.5 w-1.5 bg-amber-500" label="Active health event" inline />
      <LegendItem swatch="rounded-full h-1.5 w-1.5 bg-foreground/30" label="Meals logged" inline />
    </div>
  );
}

function LegendItem({
  swatch,
  label,
  inline,
}: {
  swatch: string;
  label: string;
  inline?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={inline ? swatch : `inline-block h-3 w-3 rounded-sm ${swatch}`} />
      <span>{label}</span>
    </span>
  );
}

function backgroundClassFor(direction: "good" | "warn" | "neutral"): string {
  switch (direction) {
    case "good":
      return "bg-emerald-500/10 border-emerald-500/30";
    case "warn":
      return "bg-amber-500/10 border-amber-500/30";
    case "neutral":
      return "bg-card border-border";
  }
}

function intensityClass(rpe: number | null): string {
  if (rpe == null) return "bg-zinc-500/15 text-zinc-800 dark:text-zinc-200 border-zinc-500/30";
  if (rpe <= 3) return "bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border-emerald-500/40";
  if (rpe <= 6) return "bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/40";
  return "bg-rose-500/20 text-rose-900 dark:text-rose-200 border-rose-500/40";
}

function shortTypeLabel(type: string): string {
  const t = type.trim();
  if (t.length <= 4) return t;
  return t.slice(0, 4);
}

function wellnessComposite(d: CalendarDaily | undefined): number | null {
  if (!d) return null;
  const xs = [d.fatigue, d.soreness, d.mood, d.stress, d.motivation, d.sleep_quality].filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function monthsCovering(startDate: string, endDate: string): Array<{ year: number; month: number }> {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (end < start) return [];
  const out: Array<{ year: number; month: number }> = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cur <= last) {
    out.push({ year: cur.getUTCFullYear(), month: cur.getUTCMonth() });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}

function groupBy<T>(rows: ReadonlyArray<T>, key: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = out.get(k);
    if (arr) arr.push(r);
    else out.set(k, [r]);
  }
  return out;
}
