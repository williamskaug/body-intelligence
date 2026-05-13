import { Badge } from "@/components/ui/badge";
import {
  bandClass,
  classify,
  computeBaseline,
  deltaString,
} from "@/lib/data-display/baseline";
import { displayForType, formatStat } from "@/lib/data-display/workout-types";

export type TimelineWorkout = {
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

export type TimelineDaily = {
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
  body_fat_pct: string | null;
  steps: number | null;
  active_calories: number | null;
  floors_climbed: number | null;
  intensity_min_moderate: number | null;
  intensity_min_vigorous: number | null;
  fatigue: number | null;
  soreness: number | null;
  mood: number | null;
  stress: number | null;
  motivation: number | null;
  sleep_quality: number | null;
  sleep_notes: string | null;
  wellness_notes: string | null;
  meal_notes: string | null;
};

export type TimelineMeal = {
  id: string;
  eaten_at: string;
  meal_type: string | null;
  description: string;
  calories: number | null;
  protein_g: string | null;
  carbs_g: string | null;
  fat_g: string | null;
  fiber_g: string | null;
  notes: string | null;
  source: string;
};

export type TimelineEvent = {
  id: string;
  date: string;
  kind: string;
  body_part: string | null;
  severity: number | null;
  notes: string | null;
  resolved_date: string | null;
};

type Props = {
  workouts: ReadonlyArray<TimelineWorkout>;
  daily: ReadonlyArray<TimelineDaily>;
  meals: ReadonlyArray<TimelineMeal>;
  events: ReadonlyArray<TimelineEvent>;
};

const WELLNESS_KEYS = [
  { key: "fatigue", short: "Ftg", long: "Fatigue" },
  { key: "soreness", short: "Sor", long: "Soreness" },
  { key: "mood", short: "Mood", long: "Mood" },
  { key: "stress", short: "Strs", long: "Stress" },
  { key: "motivation", short: "Mtv", long: "Motivation" },
  { key: "sleep_quality", short: "SlQ", long: "Sleep quality" },
] as const;

export function Timeline({ workouts, daily, meals, events }: Props) {
  // Group everything by date. Each day with any data becomes a card.
  const dates = collectDates(workouts, daily, meals, events);
  if (dates.length === 0) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
        No data in this window. Log a workout, daily check-in, or meal to see it
        appear here.
      </div>
    );
  }

  // Baselines over the whole window — wellness scales use 1–5 mean,
  // continuous metrics use their own scale.
  const baselines = {
    sleep_h: computeBaseline(daily.map((d) => num(d.sleep_h))),
    hrv_ms: computeBaseline(daily.map((d) => d.hrv_ms)),
    rhr_bpm: computeBaseline(daily.map((d) => d.rhr_bpm)),
    spo2_avg_pct: computeBaseline(daily.map((d) => num(d.spo2_avg_pct))),
    respiration_avg_brpm: computeBaseline(daily.map((d) => num(d.respiration_avg_brpm))),
    body_fat_pct: computeBaseline(daily.map((d) => num(d.body_fat_pct))),
    steps: computeBaseline(daily.map((d) => d.steps)),
    active_calories: computeBaseline(daily.map((d) => d.active_calories)),
    floors_climbed: computeBaseline(daily.map((d) => d.floors_climbed)),
    intensity_min_moderate: computeBaseline(daily.map((d) => d.intensity_min_moderate)),
    intensity_min_vigorous: computeBaseline(daily.map((d) => d.intensity_min_vigorous)),
    fatigue: computeBaseline(daily.map((d) => d.fatigue)),
    soreness: computeBaseline(daily.map((d) => d.soreness)),
    mood: computeBaseline(daily.map((d) => d.mood)),
    stress: computeBaseline(daily.map((d) => d.stress)),
    motivation: computeBaseline(daily.map((d) => d.motivation)),
    sleep_quality: computeBaseline(daily.map((d) => d.sleep_quality)),
  };

  const workoutsByDate = groupBy(workouts, (w) => w.date);
  const dailyByDate = groupBy(daily, (d) => d.date);
  const eventsByDate = groupBy(events, (e) => e.date);
  const mealsByDate = groupBy(meals, (m) => m.eaten_at.slice(0, 10));

  // Unresolved events that started before the window — surface as a banner.
  const openOlder = events.filter((e) => !e.resolved_date && !dates.includes(e.date));

  return (
    <div className="flex flex-col gap-3">
      {openOlder.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <div className="font-medium text-amber-800 dark:text-amber-300">
            Unresolved health events from before this window
          </div>
          <ul className="mt-1 flex flex-wrap gap-2 text-xs">
            {openOlder.map((e) => (
              <li
                key={e.id}
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-900 dark:text-amber-200"
              >
                <span className="font-mono">{e.date}</span> · {e.kind}
                {e.body_part ? <> · {e.body_part}</> : null}
                {e.severity ? <> · severity {e.severity}/5</> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dates.map((date) => {
        const d = dailyByDate.get(date)?.[0];
        const ws = workoutsByDate.get(date) ?? [];
        const ms = mealsByDate.get(date) ?? [];
        const es = eventsByDate.get(date) ?? [];

        return (
          <DayCard
            key={date}
            date={date}
            daily={d}
            workouts={ws}
            meals={ms}
            events={es}
            baselines={baselines}
          />
        );
      })}
    </div>
  );
}

function DayCard({
  date,
  daily,
  workouts,
  meals,
  events,
  baselines,
}: {
  date: string;
  daily: TimelineDaily | undefined;
  workouts: TimelineWorkout[];
  meals: TimelineMeal[];
  events: TimelineEvent[];
  baselines: Record<string, ReturnType<typeof computeBaseline>>;
}) {
  const headerVitals: Array<{
    label: string;
    value: string | number | null | undefined;
    unit: string;
    decimals: number;
    baseline: ReturnType<typeof computeBaseline>;
    higherIsBetter: boolean | null;
  }> = [
    { label: "Sleep", value: daily?.sleep_h, unit: "h", decimals: 1, baseline: baselines.sleep_h, higherIsBetter: true },
    { label: "HRV", value: daily?.hrv_ms, unit: "ms", decimals: 0, baseline: baselines.hrv_ms, higherIsBetter: true },
    { label: "RHR", value: daily?.rhr_bpm, unit: "bpm", decimals: 0, baseline: baselines.rhr_bpm, higherIsBetter: false },
    { label: "Wt", value: daily?.weight_kg, unit: "kg", decimals: 1, baseline: null, higherIsBetter: null },
  ];

  const wellnessValues = daily
    ? WELLNESS_KEYS.map((w) => ({ ...w, value: daily[w.key] as number | null }))
    : [];
  const hasWellness = wellnessValues.some((w) => w.value != null);

  return (
    <article className="rounded-2xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-5 pt-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-semibold tracking-tight">
            {weekdayLong(date)}
            <span className="text-muted-foreground">, {monthDay(date)}</span>
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {date}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {headerVitals.map((v) => (
            <ContinuousChip
              key={v.label}
              label={v.label}
              value={v.value}
              unit={v.unit}
              decimals={v.decimals}
              baseline={v.baseline}
              higherIsBetter={v.higherIsBetter}
            />
          ))}
        </div>
      </header>

      {hasWellness ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 px-5">
          {wellnessValues.map((w) =>
            w.value == null ? null : (
              <WellnessGauge
                key={w.key}
                label={w.short}
                title={w.long}
                value={w.value}
                baseline={baselines[w.key] ?? null}
              />
            ),
          )}
        </div>
      ) : null}

      {daily && hasSleepStages(daily) ? (
        <div className="mt-3 px-5">
          <SleepStagesBar daily={daily} />
        </div>
      ) : null}

      {daily && hasVitals(daily) ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 px-5 text-xs">
          <ContinuousChip
            label="SpO₂"
            value={daily.spo2_avg_pct}
            unit="%"
            decimals={1}
            baseline={baselines.spo2_avg_pct}
            higherIsBetter={true}
          />
          <ContinuousChip
            label="Resp"
            value={daily.respiration_avg_brpm}
            unit="brpm"
            decimals={1}
            baseline={baselines.respiration_avg_brpm}
            higherIsBetter={null}
          />
          <ContinuousChip
            label="BF"
            value={daily.body_fat_pct}
            unit="%"
            decimals={1}
            baseline={baselines.body_fat_pct}
            higherIsBetter={null}
          />
        </div>
      ) : null}

      {daily && hasActivity(daily) ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 px-5 text-xs">
          <ContinuousChip
            label="Steps"
            value={daily.steps}
            unit=""
            decimals={0}
            baseline={baselines.steps}
            higherIsBetter={true}
          />
          <ContinuousChip
            label="Act"
            value={daily.active_calories}
            unit="kcal"
            decimals={0}
            baseline={baselines.active_calories}
            higherIsBetter={true}
          />
          <ContinuousChip
            label="Floors"
            value={daily.floors_climbed}
            unit=""
            decimals={0}
            baseline={baselines.floors_climbed}
            higherIsBetter={true}
          />
          <ContinuousChip
            label="Mod"
            value={daily.intensity_min_moderate}
            unit="min"
            decimals={0}
            baseline={baselines.intensity_min_moderate}
            higherIsBetter={true}
          />
          <ContinuousChip
            label="Vig"
            value={daily.intensity_min_vigorous}
            unit="min"
            decimals={0}
            baseline={baselines.intensity_min_vigorous}
            higherIsBetter={true}
          />
        </div>
      ) : null}

      {workouts.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2 px-5">
          {workouts.map((w) => (
            <WorkoutRow key={w.id} workout={w} />
          ))}
        </div>
      ) : null}

      {meals.length > 0 ? (
        <div className="mt-3 px-5">
          <MealsRow meals={meals} />
        </div>
      ) : null}

      {events.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1.5 px-5">
          {events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      ) : null}

      {daily && (daily.sleep_notes || daily.wellness_notes || daily.meal_notes) ? (
        <div className="mt-4 space-y-2 border-t bg-muted/20 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
          {daily.sleep_notes ? (
            <NoteRow accent="bg-indigo-500/70" label="Sleep" body={daily.sleep_notes} />
          ) : null}
          {daily.wellness_notes ? (
            <NoteRow accent="bg-emerald-500/70" label="Wellness" body={daily.wellness_notes} />
          ) : null}
          {daily.meal_notes ? (
            <NoteRow accent="bg-amber-500/70" label="Meals" body={daily.meal_notes} />
          ) : null}
        </div>
      ) : (
        <div className="h-4" />
      )}
    </article>
  );
}

function NoteRow({
  accent,
  label,
  body,
}: {
  accent: string;
  label: string;
  body: string;
}) {
  return (
    <div className="flex gap-2">
      <span
        aria-hidden
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent}`}
      />
      <div className="min-w-0">
        <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/70">
          {label}
        </span>
        <p className="mt-0.5">{body}</p>
      </div>
    </div>
  );
}

function ContinuousChip({
  label,
  value,
  unit,
  decimals,
  baseline,
  higherIsBetter,
}: {
  label: string;
  value: string | number | null | undefined;
  unit: string;
  decimals: number;
  baseline: ReturnType<typeof computeBaseline>;
  higherIsBetter: boolean | null;
}) {
  const v = value == null ? null : Number(value);
  if (v == null || !Number.isFinite(v)) return null;
  const cls = classify(v, baseline ?? null, higherIsBetter);
  const delta = deltaString(v, baseline ?? null, decimals);
  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded-md border px-1.5 py-0.5 ${bandClass(cls.direction)}`}
      title={baseline ? `${label} baseline: ${baseline.mean.toFixed(decimals)} ${unit}` : undefined}
    >
      <span className="text-[10px] uppercase tracking-wide opacity-80">{label}</span>
      <span className="font-mono tabular-nums">{v.toFixed(decimals)}</span>
      {unit ? <span className="text-[10px] opacity-70">{unit}</span> : null}
      {delta ? (
        <span className="ml-0.5 text-[10px] tabular-nums opacity-70">{delta}</span>
      ) : null}
    </span>
  );
}

function WellnessGauge({
  label,
  title,
  value,
  baseline,
}: {
  label: string;
  title: string;
  value: number;
  baseline: ReturnType<typeof computeBaseline>;
}) {
  const cls = classify(value, baseline ?? null, true);
  const filled = gaugeBarColor(cls.direction);
  const empty = "bg-foreground/15";
  const baselineLabel = baseline ? ` (baseline ${baseline.mean.toFixed(1)})` : "";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`${title}: ${value}/5${baselineLabel}`}
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex gap-[2px]">
        {[1, 2, 3, 4, 5].map((level) => (
          <span
            key={level}
            className={`h-3 w-[3px] rounded-[1px] ${level <= value ? filled : empty}`}
          />
        ))}
      </span>
    </span>
  );
}

function gaugeBarColor(direction: "good" | "warn" | "neutral"): string {
  switch (direction) {
    case "good":
      return "bg-emerald-500";
    case "warn":
      return "bg-amber-500";
    case "neutral":
      return "bg-foreground/60";
  }
}

function WorkoutRow({ workout: w }: { workout: TimelineWorkout }) {
  const display = displayForType(w.type);
  const primaryKeys = new Set(display.stats);
  const stats = display.stats
    .map((k) => formatStat(k, w))
    .filter((s): s is { label: string; value: string } => s != null);
  // Secondary fields: anything captured that the type-specific display doesn't
  // already surface. Avoids "—" placeholders but still shows everything we have.
  const secondary: Array<{ label: string; value: string }> = [];
  if (!primaryKeys.has("max_hr") && w.max_hr != null) {
    secondary.push({ label: "max HR", value: String(w.max_hr) });
  }
  if (!primaryKeys.has("shoes") && w.shoes) {
    secondary.push({ label: "shoes", value: w.shoes });
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${display.color}`}
      >
        {w.type}
      </span>
      {stats.map((s, i) => (
        <span key={i} className="text-sm">
          <span className="font-mono tabular-nums">{s.value}</span>{" "}
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {s.label}
          </span>
        </span>
      ))}
      {secondary.map((s, i) => (
        <span key={`sec-${i}`} className="text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{s.value}</span>{" "}
          <span className="text-[10px] uppercase tracking-wide">{s.label}</span>
        </span>
      ))}
      {w.source !== "manual" ? (
        <Badge variant="outline" className="text-[10px]">
          {w.source}
        </Badge>
      ) : null}
      {w.notes ? (
        <span className="ml-1 truncate text-xs text-muted-foreground" title={w.notes}>
          · {w.notes}
        </span>
      ) : null}
    </div>
  );
}

function MealsRow({ meals }: { meals: TimelineMeal[] }) {
  const sorted = [...meals].sort((a, b) => a.eaten_at.localeCompare(b.eaten_at));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Meals
      </span>
      {sorted.map((m) => (
        <MealChip key={m.id} meal={m} />
      ))}
    </div>
  );
}

function MealChip({ meal: m }: { meal: TimelineMeal }) {
  const macroParts: string[] = [];
  if (m.calories != null) macroParts.push(`${m.calories} kcal`);
  if (m.protein_g != null) macroParts.push(`${Number(m.protein_g).toFixed(0)}P`);
  if (m.carbs_g != null) macroParts.push(`${Number(m.carbs_g).toFixed(0)}C`);
  if (m.fat_g != null) macroParts.push(`${Number(m.fat_g).toFixed(0)}F`);
  if (m.fiber_g != null) macroParts.push(`${Number(m.fiber_g).toFixed(0)}g fiber`);
  return (
    <div className="flex max-w-[22rem] flex-col gap-0.5 rounded-md border bg-muted/30 px-2 py-1 text-xs">
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[10px] text-muted-foreground">
          {m.eaten_at.slice(11, 16)}
        </span>
        {m.meal_type ? (
          <span className="text-[10px] capitalize text-muted-foreground">
            {m.meal_type}
          </span>
        ) : null}
        <span className="truncate" title={m.description}>
          {m.description}
        </span>
        {m.source !== "manual" ? (
          <Badge variant="outline" className="ml-auto text-[10px]">
            {m.source}
          </Badge>
        ) : null}
      </div>
      {macroParts.length > 0 || m.notes ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          {macroParts.length > 0 ? (
            <span className="font-mono tabular-nums">{macroParts.join(" · ")}</span>
          ) : null}
          {m.notes ? <span className="italic">{m.notes}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function SleepStagesBar({ daily }: { daily: TimelineDaily }) {
  const stages = [
    { key: "deep", label: "Deep", min: daily.sleep_deep_min, color: "bg-indigo-600/80", dot: "bg-indigo-600" },
    { key: "rem", label: "REM", min: daily.sleep_rem_min, color: "bg-violet-500/80", dot: "bg-violet-500" },
    { key: "light", label: "Light", min: daily.sleep_light_min, color: "bg-sky-400/70", dot: "bg-sky-400" },
    { key: "awake", label: "Awake", min: daily.sleep_awake_min, color: "bg-amber-500/60", dot: "bg-amber-500" },
  ] as const;
  const total = stages.reduce((a, s) => a + (s.min ?? 0), 0);
  if (total <= 0) return null;
  const present = stages.filter((s) => (s.min ?? 0) > 0);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Sleep stages
        </span>
        <div
          className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted"
          title={present.map((s) => `${s.label}: ${s.min}min`).join(" · ")}
        >
          {stages.map((s) =>
            s.min && s.min > 0 ? (
              <div
                key={s.key}
                className={s.color}
                style={{ width: `${(s.min / total) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {Math.round(total)} min
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[5.25rem] text-[10px] text-muted-foreground">
        {present.map((s) => {
          const pct = ((s.min ?? 0) / total) * 100;
          return (
            <span key={s.key} className="inline-flex items-center gap-1">
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              <span>{s.label}</span>
              <span className="font-mono tabular-nums opacity-70">
                {Math.round(pct)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function hasSleepStages(d: TimelineDaily): boolean {
  return (
    d.sleep_deep_min != null ||
    d.sleep_light_min != null ||
    d.sleep_rem_min != null ||
    d.sleep_awake_min != null
  );
}

function hasVitals(d: TimelineDaily): boolean {
  return (
    d.spo2_avg_pct != null ||
    d.respiration_avg_brpm != null ||
    d.body_fat_pct != null
  );
}

function hasActivity(d: TimelineDaily): boolean {
  return (
    d.steps != null ||
    d.active_calories != null ||
    d.floors_climbed != null ||
    d.intensity_min_moderate != null ||
    d.intensity_min_vigorous != null
  );
}

function EventRow({ event: e }: { event: TimelineEvent }) {
  const tone = e.resolved_date
    ? "bg-muted text-muted-foreground border-border"
    : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30";
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 ${tone}`}
        >
          <span className="font-medium uppercase tracking-wide">{e.kind}</span>
          {e.body_part ? <span>· {e.body_part}</span> : null}
          {e.severity ? (
            <span className="text-[10px] opacity-75">sev {e.severity}/5</span>
          ) : null}
          {e.resolved_date ? (
            <span className="text-[10px] opacity-75">resolved {e.resolved_date}</span>
          ) : null}
        </span>
      </div>
      {e.notes ? (
        <p className="pl-2 text-[11px] italic text-muted-foreground">{e.notes}</p>
      ) : null}
    </div>
  );
}

function collectDates(
  workouts: ReadonlyArray<TimelineWorkout>,
  daily: ReadonlyArray<TimelineDaily>,
  meals: ReadonlyArray<TimelineMeal>,
  events: ReadonlyArray<TimelineEvent>,
): string[] {
  const set = new Set<string>();
  for (const w of workouts) set.add(w.date);
  for (const d of daily) set.add(d.date);
  for (const m of meals) set.add(m.eaten_at.slice(0, 10));
  for (const e of events) set.add(e.date);
  return Array.from(set).sort((a, b) => b.localeCompare(a));
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

function num(s: string | null): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function weekdayLong(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });
}

function monthDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
