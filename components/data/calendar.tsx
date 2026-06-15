import { computeBaseline, classify } from "@/lib/data-display/baseline";
import { type Gate, GATE_FILL_CLASS } from "@/lib/data-display/derived";
import {
  chartColorForType,
  normalizeType,
  shortLabelForType,
} from "@/lib/data-display/workout-types";

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
  events: ReadonlyArray<CalendarEvent>;
  /** Agent-computed readiness gate per date — renders a corner dot when present. */
  derivedGateByDate?: Record<string, Gate>;
  startDate: string;
  endDate: string;
};

export function Calendar({
  workouts,
  daily,
  events,
  derivedGateByDate,
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
  const eventsByDate = groupBy(events, (e) => e.date);
  const gateByDate = derivedGateByDate ?? {};

  const todayIso = new Date().toISOString().slice(0, 10);
  const anyData =
    workouts.length > 0 || daily.length > 0 || events.length > 0;

  return (
    <div className="flex flex-col gap-8">
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
          eventsByDate={eventsByDate}
          gateByDate={gateByDate}
          wellnessBaseline={wellnessBaseline}
        />
      ))}
      <Legend />
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
  eventsByDate,
  gateByDate,
  wellnessBaseline,
}: {
  year: number;
  month: number; // 0-indexed
  startDate: string;
  endDate: string;
  todayIso: string;
  workoutsByDate: Map<string, CalendarWorkout[]>;
  dailyByDate: Map<string, CalendarDaily>;
  eventsByDate: Map<string, CalendarEvent[]>;
  gateByDate: Record<string, Gate>;
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
      <h3 className="mb-3 flex items-baseline gap-2 text-sm font-semibold tracking-tight">
        <span>{monthLabel}</span>
        <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
          Wk starts Mon
        </span>
      </h3>
      <div
        className="grid grid-cols-7 gap-1 text-xs sm:gap-1.5"
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
            events={eventsByDate.get(cell.iso) ?? []}
            gate={gateByDate[cell.iso]}
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
  events,
  gate,
  wellnessBaseline,
}: {
  iso: string;
  inMonth: boolean;
  inWindow: boolean;
  isToday: boolean;
  workouts: CalendarWorkout[];
  daily: CalendarDaily | undefined;
  events: CalendarEvent[];
  gate: Gate | undefined;
  wellnessBaseline: ReturnType<typeof computeBaseline>;
}) {
  const dayNum = Number(iso.slice(8, 10));

  if (!inMonth) {
    return (
      <div className="aspect-square min-h-[64px] rounded-md border border-transparent" />
    );
  }
  if (!inWindow) {
    return (
      <div className="aspect-square min-h-[64px] rounded-md border border-dashed border-border/40 p-1 text-muted-foreground/40">
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
  if (events.length > 0) {
    for (const e of events) {
      titleLines.push(`${e.kind}${e.body_part ? ` · ${e.body_part}` : ""}${e.resolved_date ? "" : " (active)"}`);
    }
  }
  if (gate) titleLines.push(`Readiness gate: ${gate}`);

  return (
    <div
      className={`relative flex aspect-square min-h-[64px] flex-col rounded-md border p-1 transition-colors ${bg} ${
        isToday ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""
      }`}
      title={titleLines.join("\n")}
    >
      {gate ? (
        <span
          className={`absolute right-1 bottom-1 h-1.5 w-1.5 rounded-full ${GATE_FILL_CLASS[gate]}`}
          aria-label={`readiness gate ${gate}`}
          title={`Readiness gate: ${gate}`}
        />
      ) : null}
      <div className="flex items-start justify-between">
        <span
          className={`font-mono text-[11px] tabular-nums ${
            isToday ? "font-bold text-foreground" : "text-foreground/80"
          }`}
        >
          {dayNum}
        </span>
        <div className="flex items-center gap-0.5">
          {daily ? (
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              aria-label="daily entry logged"
              title="Daily check-in logged"
            />
          ) : null}
          {events.some((e) => !e.resolved_date) ? (
            <span
              className="h-1.5 w-1.5 rounded-full bg-rose-500"
              aria-label="active health event"
              title="Active health event"
            />
          ) : events.length > 0 ? (
            <span
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
              aria-label="resolved health event"
            />
          ) : null}
        </div>
      </div>

      {workouts.length > 0 ? (
        <div className="mt-auto flex flex-col gap-[2px]">
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
  // Height proportional to duration so shape-perception works at a glance:
  // 30 min → ~6px, 60 min → ~10px, 120 min → ~16px, 254-min golf → 22px (clamped).
  const min = w.duration_min ?? 0;
  const height = Math.max(4, Math.min(22, Math.round(min / 8) + 4));
  const showLabel = height >= 14;
  const color = chartColorForType(normalizeType(w.type));
  const label = shortLabelForType(w.type);
  return (
    <div
      title={`${w.type}${w.duration_min ? ` · ${w.duration_min}min` : ""}${w.rpe ? ` · RPE ${w.rpe}` : ""}`}
      style={{ height: `${height}px`, backgroundColor: color }}
      className="flex items-center gap-1 overflow-hidden rounded-sm px-1 leading-none text-white shadow-sm"
    >
      {showLabel ? (
        <>
          <span className="truncate text-[9px] font-semibold uppercase tracking-wide">
            {label}
          </span>
          {w.duration_min != null ? (
            <span className="ml-auto font-mono text-[9px] tabular-nums opacity-90">
              {w.duration_min}′
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Legend() {
  return (
    <details className="group rounded-lg border bg-card/50 px-3 py-2 text-[11px] text-muted-foreground">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wide">
        <span>Legend</span>
        <span className="transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <LegendItem swatch="bg-emerald-500/30 border-emerald-500/40" label="Wellness above baseline" />
        <LegendItem swatch="bg-card border-border" label="In baseline" />
        <LegendItem swatch="bg-amber-500/30 border-amber-500/40" label="Below baseline" />
        <span className="mx-2 hidden h-3 w-px bg-border sm:inline-block" />
        <span className="text-[10px]">Workout bars: color by type, height by duration.</span>
        <span className="mx-2 hidden h-3 w-px bg-border sm:inline-block" />
        <LegendItem swatch="rounded-full h-1.5 w-1.5 bg-emerald-500" label="Daily check-in" inline />
        <LegendItem swatch="rounded-full h-1.5 w-1.5 bg-rose-500" label="Active event" inline />
        <LegendItem swatch={`rounded-full h-1.5 w-1.5 ${GATE_FILL_CLASS.amber}`} label="Readiness gate (corner)" inline />
      </div>
    </details>
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
      <span className={inline ? swatch : `inline-block h-3 w-3 rounded-sm border ${swatch}`} />
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
