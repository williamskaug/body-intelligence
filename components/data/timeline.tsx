import { Badge } from "@/components/ui/badge";
import { WellnessForm } from "@/components/data/wellness-form";
import {
  detectAnomalies,
  groupAnomaliesByDate,
  type Anomaly,
} from "@/lib/data-display/anomalies";
import {
  bandClass,
  classify,
  computeBaseline,
  deltaString,
} from "@/lib/data-display/baseline";
import { type Gate, GATE_FILL_CLASS } from "@/lib/data-display/derived";
import {
  daysBetween,
  eventThread,
  type ThreadedHealthEvent,
} from "@/lib/data-display/health-events";
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
};

// Per-workout vendor dynamics joined onto a workout by id. supabase-js returns
// numeric() columns as strings; integer columns come back as numbers.
export type WorkoutMetricsRow = {
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

export type TimelineProps = {
  workouts: ReadonlyArray<TimelineWorkout>;
  daily: ReadonlyArray<TimelineDaily>;
  events: ReadonlyArray<ThreadedHealthEvent>;
  todayDate: string;
  /** Agent-computed readiness gate per date — small dot beside the heading. */
  derivedGateByDate?: Record<string, Gate>;
  /** Vendor running dynamics keyed by workout id — powers the per-workout expander. */
  metricsByWorkoutId?: Record<string, WorkoutMetricsRow>;
};

const WELLNESS_KEYS = [
  { key: "fatigue", short: "Ftg", long: "Fatigue" },
  { key: "soreness", short: "Sor", long: "Soreness" },
  { key: "mood", short: "Mood", long: "Mood" },
  { key: "stress", short: "Strs", long: "Stress" },
  { key: "motivation", short: "Mtv", long: "Motivation" },
  { key: "sleep_quality", short: "SlQ", long: "Sleep quality" },
] as const;

export function Timeline({
  workouts,
  daily,
  events,
  todayDate,
  derivedGateByDate,
  metricsByWorkoutId,
}: TimelineProps) {
  // Group everything by date. Each day with any data becomes a card.
  const dates = collectDates(workouts, daily, events);

  if (dates.length === 0) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
        No data in this window. Log a workout or daily check-in to see it appear
        here.
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

  // Unresolved events that started before the window — surface as a banner.
  const openOlder = events.filter((e) => !e.resolved_date && !dates.includes(e.date));

  const anomalies = detectAnomalies(daily, workouts);
  const anomaliesByDate = groupAnomaliesByDate(anomalies);

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
        const es = eventsByDate.get(date) ?? [];

        return (
          <DayCard
            key={date}
            date={date}
            todayDate={todayDate}
            daily={d}
            workouts={ws}
            events={es}
            baselines={baselines}
            anomalies={anomaliesByDate.get(date) ?? []}
            gate={derivedGateByDate?.[date]}
            metricsByWorkoutId={metricsByWorkoutId}
          />
        );
      })}
    </div>
  );
}

function DayAnomalyBadges({ anomalies }: { anomalies: ReadonlyArray<Anomaly> }) {
  if (anomalies.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {anomalies.map((a, i) => (
        <span
          key={`${a.kind}-${i}`}
          title={a.message}
          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${anomalyBadgeClass(a.severity)}`}
        >
          {anomalyLabel(a.kind)}
        </span>
      ))}
    </div>
  );
}

// "info" is noteworthy but not a warning (e.g. long recovery sleep) — render it
// neutral gray, never amber/red.
function anomalyBadgeClass(severity: Anomaly["severity"]): string {
  switch (severity) {
    case "high":
      return "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "medium":
      return "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "low":
    case "info":
      return "border-foreground/20 bg-muted text-muted-foreground";
  }
}

function anomalyLabel(kind: Anomaly["kind"]): string {
  switch (kind) {
    case "rhr_high":
      return "RHR ↑";
    case "hrv_low":
      return "HRV ↓";
    case "sleep_long":
      return "long sleep";
    case "sleep_short":
      return "short sleep";
    case "missing_hrv":
      return "no HRV";
    case "missing_rhr":
      return "no RHR";
    case "rpe_high_streak":
      return "hard streak";
  }
}

function DayCard({
  date,
  todayDate,
  daily,
  workouts,
  events,
  baselines,
  anomalies,
  gate,
  metricsByWorkoutId,
}: {
  date: string;
  todayDate: string;
  daily: TimelineDaily | undefined;
  workouts: TimelineWorkout[];
  events: ThreadedHealthEvent[];
  baselines: Record<string, ReturnType<typeof computeBaseline>>;
  anomalies: ReadonlyArray<Anomaly>;
  gate: Gate | undefined;
  metricsByWorkoutId?: Record<string, WorkoutMetricsRow>;
}) {
  // Primary header chips — capped at FOUR: sleep, HRV, RHR, weight.
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
          <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            {gate ? (
              <span
                aria-hidden
                title={`readiness gate: ${gate}`}
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${GATE_FILL_CLASS[gate]}`}
              />
            ) : null}
            <span>
              {weekdayLong(date)}
              <span className="text-muted-foreground">, {monthDay(date)}</span>
            </span>
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {date}
          </span>
          <DayAnomalyBadges anomalies={anomalies} />
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

      {workouts.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2 px-5">
          {workouts.map((w) => (
            <WorkoutRow
              key={w.id}
              workout={w}
              metrics={metricsByWorkoutId?.[w.id]}
            />
          ))}
        </div>
      ) : null}

      {daily && hasSleepStages(daily) ? (
        <div className="mt-3 px-5">
          <SleepStagesBar daily={daily} />
        </div>
      ) : null}

      {daily ? <MoreMetricsRow daily={daily} baselines={baselines} /> : null}

      {events.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1.5 px-5">
          {events.map((e) => (
            <EventRow key={e.id} event={e} todayDate={todayDate} />
          ))}
        </div>
      ) : null}

      {daily && (daily.sleep_notes || daily.wellness_notes) ? (
        <div className="mt-4 space-y-2 border-t bg-muted/20 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
          {daily.sleep_notes ? (
            <NoteRow accent="bg-indigo-500/70" label="Sleep" body={daily.sleep_notes} />
          ) : null}
          {daily.wellness_notes ? (
            <NoteRow accent="bg-emerald-500/70" label="Wellness" body={daily.wellness_notes} />
          ) : null}
        </div>
      ) : (
        <div className="h-4" />
      )}

      <details className="border-t bg-muted/10">
        <summary className="cursor-pointer px-5 py-2 text-[11px] text-muted-foreground hover:text-foreground">
          Log / edit check-in
        </summary>
        <div className="px-5 pb-4">
          <WellnessForm
            date={date}
            initial={daily ?? undefined}
            title={`Edit ${date}`}
            subtitle="Updates upsert into the daily entry; omitted fields are preserved."
          />
        </div>
      </details>
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
    <details className="group flex gap-2">
      <summary className="flex cursor-pointer list-none gap-2">
        <span
          aria-hidden
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent}`}
        />
        <div className="min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/70">
            {label}
          </span>
          <p className="mt-0.5 line-clamp-2 group-open:line-clamp-none whitespace-pre-wrap">
            {body}
          </p>
        </div>
      </summary>
    </details>
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

function WorkoutRow({
  workout: w,
  metrics,
}: {
  workout: TimelineWorkout;
  metrics: WorkoutMetricsRow | undefined;
}) {
  const display = displayForType(w.type);
  const stats = display.stats
    .map((k) => formatStat(k, w))
    .filter((s): s is { label: string; value: string } => s != null);

  const dynamics = metrics ? buildDynamics(metrics) : [];
  const hasExpander =
    Boolean(w.notes) ||
    dynamics.length > 0 ||
    Boolean(w.shoes) ||
    w.max_hr != null;

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm">
        {hasExpander ? (
          <span
            aria-hidden
            className="shrink-0 text-[10px] text-muted-foreground transition-transform group-open:rotate-90"
          >
            ▶
          </span>
        ) : null}
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${display.color}`}
        >
          {display.displayName}
        </span>
        {stats.map((s, i) => (
          <span key={i} className="text-sm">
            <span className="font-mono tabular-nums">{s.value}</span>{" "}
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {s.label}
            </span>
          </span>
        ))}
        {w.source !== "manual" ? (
          <Badge variant="outline" className="text-[10px] capitalize">
            {sourceLabel(w.source)}
          </Badge>
        ) : null}
      </summary>

      {hasExpander ? (
        <div className="mt-2 flex flex-col gap-3 pl-5">
          {w.notes ? (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {w.notes}
            </p>
          ) : null}

          {dynamics.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
              {dynamics.map((d) => (
                <div key={d.label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {d.label}
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-mono tabular-nums">{d.value}</span>
                    {d.chip ? (
                      <span
                        className={`rounded-[3px] border px-1 py-px text-[9px] font-medium uppercase tracking-wide ${d.chip.warn ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300" : "border-border bg-muted text-muted-foreground"}`}
                      >
                        {d.chip.text}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {w.shoes || w.max_hr != null ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {w.shoes ? (
                <span>
                  shoes <span className="font-mono tabular-nums normal-case">{w.shoes}</span>
                </span>
              ) : null}
              {w.max_hr != null ? (
                <span>
                  max HR <span className="font-mono tabular-nums">{w.max_hr}</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}

// Build the non-null vendor-dynamics rows for a workout's expander. Each row is
// a label + display value, plus an optional chip (e.g. GCT asymmetry warning).
function buildDynamics(
  m: WorkoutMetricsRow,
): Array<{ label: string; value: string; chip?: { text: string; warn: boolean } }> {
  const out: Array<{ label: string; value: string; chip?: { text: string; warn: boolean } }> = [];

  const cadence = num(m.cadence_spm);
  if (cadence != null) {
    out.push({ label: "Cadence", value: `${Math.round(cadence)} spm` });
  }

  const left = num(m.gct_balance_pct_left);
  if (left != null) {
    const right = 100 - left;
    const asym = Math.abs(left - 50) * 2;
    out.push({
      label: "GCT balance",
      value: `${left.toFixed(1)}% L / ${right.toFixed(1)}% R`,
      chip: { text: `${asym.toFixed(1)}% asym`, warn: asym > 5 },
    });
  }

  const teA = num(m.te_aerobic);
  const teAn = num(m.te_anaerobic);
  if (teA != null || teAn != null) {
    const parts: string[] = [];
    if (teA != null) parts.push(`${teA.toFixed(1)} aero`);
    if (teAn != null) parts.push(`${teAn.toFixed(1)} anaero`);
    out.push({ label: "Training effect", value: parts.join(" · ") });
  }

  const load = num(m.vendor_training_load);
  if (load != null) {
    out.push({ label: "Training load", value: String(Math.round(load)) });
  }

  if (m.stamina_start_pct != null || m.stamina_min_pct != null) {
    const start = m.stamina_start_pct;
    const min = m.stamina_min_pct;
    out.push({
      label: "Stamina",
      value:
        start != null && min != null
          ? `${start}% → ${min}%`
          : `${start ?? min}%`,
    });
  }

  const decoupling = num(m.decoupling_pct);
  if (decoupling != null) {
    out.push({ label: "Decoupling", value: `${decoupling.toFixed(1)}%` });
  }

  if (m.elevation_gain_m != null || m.elevation_loss_m != null) {
    const gain = m.elevation_gain_m != null ? `+${m.elevation_gain_m}` : "";
    const loss = m.elevation_loss_m != null ? `−${m.elevation_loss_m}` : "";
    out.push({
      label: "Elevation",
      value: [gain, loss].filter(Boolean).join(" / ") + " m",
    });
  }

  const avgSpeed = num(m.avg_speed_kmh);
  const maxSpeed = num(m.max_speed_kmh);
  if (avgSpeed != null || maxSpeed != null) {
    const parts: string[] = [];
    if (avgSpeed != null) parts.push(`${avgSpeed.toFixed(1)} avg`);
    if (maxSpeed != null) parts.push(`${maxSpeed.toFixed(1)} max`);
    out.push({ label: "Speed (km/h)", value: parts.join(" · ") });
  }

  return out;
}

function sourceLabel(source: string): string {
  const idx = source.indexOf("_");
  return idx === -1 ? source : source.slice(0, idx);
}

// SpO2, respiration, body fat, steps, active kcal, floors, intensity minutes —
// all rolled into one collapsed line so the default card stays ≤4 chips.
function MoreMetricsRow({
  daily,
  baselines,
}: {
  daily: TimelineDaily;
  baselines: Record<string, ReturnType<typeof computeBaseline>>;
}) {
  const chips: Array<{
    label: string;
    value: string | number | null;
    unit: string;
    decimals: number;
    baseline: ReturnType<typeof computeBaseline>;
    higherIsBetter: boolean | null;
  }> = [
    { label: "SpO₂", value: daily.spo2_avg_pct, unit: "%", decimals: 1, baseline: baselines.spo2_avg_pct, higherIsBetter: true },
    { label: "Resp", value: daily.respiration_avg_brpm, unit: "brpm", decimals: 1, baseline: baselines.respiration_avg_brpm, higherIsBetter: null },
    { label: "BF", value: daily.body_fat_pct, unit: "%", decimals: 1, baseline: baselines.body_fat_pct, higherIsBetter: null },
    { label: "Steps", value: daily.steps, unit: "", decimals: 0, baseline: baselines.steps, higherIsBetter: true },
    { label: "Act", value: daily.active_calories, unit: "kcal", decimals: 0, baseline: baselines.active_calories, higherIsBetter: true },
    { label: "Floors", value: daily.floors_climbed, unit: "", decimals: 0, baseline: baselines.floors_climbed, higherIsBetter: true },
    { label: "Mod", value: daily.intensity_min_moderate, unit: "min", decimals: 0, baseline: baselines.intensity_min_moderate, higherIsBetter: true },
    { label: "Vig", value: daily.intensity_min_vigorous, unit: "min", decimals: 0, baseline: baselines.intensity_min_vigorous, higherIsBetter: true },
  ];
  const present = chips.filter((c) => c.value != null);
  if (present.length === 0) return null;
  return (
    <details className="mt-3 px-5">
      <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground">
        More metrics ({present.length})
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {present.map((c) => (
          <ContinuousChip
            key={c.label}
            label={c.label}
            value={c.value}
            unit={c.unit}
            decimals={c.decimals}
            baseline={c.baseline}
            higherIsBetter={c.higherIsBetter}
          />
        ))}
      </div>
    </details>
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

function EventRow({
  event: e,
  todayDate,
}: {
  event: ThreadedHealthEvent;
  todayDate: string;
}) {
  const tone = e.resolved_date
    ? "bg-muted text-muted-foreground border-border"
    : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30";
  const activeDays = e.resolved_date
    ? daysBetween(e.date, e.resolved_date)
    : daysBetween(e.date, todayDate);
  const thread = eventThread(e);
  const latest = thread.updates[0] ?? null;
  const milestoneDays =
    e.next_milestone_date != null
      ? daysBetween(todayDate, e.next_milestone_date)
      : null;
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
          <span className="text-[10px] opacity-75">
            {e.resolved_date ? `resolved · ${activeDays}d` : `active ${activeDays}d`}
          </span>
        </span>
        {e.next_milestone && e.next_milestone_date ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {e.next_milestone} ~{shortMonthDay(e.next_milestone_date)}
            {milestoneDays != null ? (
              <span className="opacity-75">
                · {milestoneDays >= 0 ? `in ${milestoneDays}d` : `${-milestoneDays}d ago`}
              </span>
            ) : null}
          </span>
        ) : null}
        <a
          href="#health-threads"
          className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
        >
          {thread.updates.length > 0
            ? `(${thread.updates.length} update${thread.updates.length === 1 ? "" : "s"})`
            : "view thread"}
        </a>
      </div>
      {latest ? (
        <p className="line-clamp-2 pl-2 text-[11px] text-muted-foreground">
          <span className="font-mono opacity-70">{latest.label}</span> {latest.note}
        </p>
      ) : null}
    </div>
  );
}

function collectDates(
  workouts: ReadonlyArray<TimelineWorkout>,
  daily: ReadonlyArray<TimelineDaily>,
  events: ReadonlyArray<ThreadedHealthEvent>,
): string[] {
  const set = new Set<string>();
  for (const w of workouts) set.add(w.date);
  for (const d of daily) set.add(d.date);
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

function num(s: string | number | null | undefined): number | null {
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

function shortMonthDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
