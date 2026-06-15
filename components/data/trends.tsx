import { BarStack } from "@/components/data/bar-stack";
import { GateStrip, type GateStripDay } from "@/components/data/gate-strip";
import { Sparkline } from "@/components/data/sparkline";
import {
  datesInRange,
  groupByDate,
  weekStart,
} from "@/lib/data-display/aggregate";
import {
  computeBaseline,
  classify,
  bandClass,
  type Baseline,
} from "@/lib/data-display/baseline";
import { formatZ, type DerivedDailyRow } from "@/lib/data-display/derived";
import {
  chartColorForType,
  displayNameForType,
  normalizeType,
} from "@/lib/data-display/workout-types";

export type TrendsDaily = {
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
};

export type TrendsWorkout = {
  /** Needed to join vendor metrics (workout_id) onto workouts. */
  id: string;
  date: string;
  type: string;
  duration_min: number | null;
  rpe: number | null;
};

export type TrendsWorkoutMetric = {
  workout_id: string;
  date: string;
  cadence_spm: string | null;
  gct_balance_pct_left: string | null;
  vendor_training_load: string | null;
};

export type TrendsProps = {
  daily: ReadonlyArray<TrendsDaily>;
  workouts: ReadonlyArray<TrendsWorkout>;
  /** derived_daily rows for the window. Any order — indexed by date internally. */
  derived: ReadonlyArray<DerivedDailyRow>;
  /** Per-workout vendor metrics for the window. Any order — sorted by date internally. */
  workoutMetrics: ReadonlyArray<TrendsWorkoutMetric>;
  startDate: string;
  endDate: string;
};

export function Trends({
  daily,
  workouts,
  derived,
  workoutMetrics,
  startDate,
  endDate,
}: TrendsProps) {
  // Align daily to a contiguous date axis so gaps render as gaps in the line.
  const dates = datesInRange(startDate, endDate);
  const dailyByDate = groupByDate(daily);

  const series = {
    sleep_h: dates.map((d) => num(dailyByDate.get(d)?.[0]?.sleep_h)),
    hrv_ms: dates.map((d) => dailyByDate.get(d)?.[0]?.hrv_ms ?? null),
    rhr_bpm: dates.map((d) => dailyByDate.get(d)?.[0]?.rhr_bpm ?? null),
    weight_kg: dates.map((d) => num(dailyByDate.get(d)?.[0]?.weight_kg)),
    wellness: dates.map((d) => wellnessComposite(dailyByDate.get(d)?.[0])),
    steps: dates.map((d) => dailyByDate.get(d)?.[0]?.steps ?? null),
    active_calories: dates.map((d) => dailyByDate.get(d)?.[0]?.active_calories ?? null),
    spo2_avg_pct: dates.map((d) => num(dailyByDate.get(d)?.[0]?.spo2_avg_pct)),
    body_fat_pct: dates.map((d) => num(dailyByDate.get(d)?.[0]?.body_fat_pct)),
  };

  const baselines = {
    sleep_h: computeBaseline(series.sleep_h),
    hrv_ms: computeBaseline(series.hrv_ms),
    rhr_bpm: computeBaseline(series.rhr_bpm),
    weight_kg: computeBaseline(series.weight_kg),
    wellness: computeBaseline(series.wellness),
    steps: computeBaseline(series.steps),
    active_calories: computeBaseline(series.active_calories),
    spo2_avg_pct: computeBaseline(series.spo2_avg_pct),
    body_fat_pct: computeBaseline(series.body_fat_pct),
  };

  const metrics = [
    { key: "sleep_h", label: "Sleep", unit: "h", decimals: 1, higher: true },
    { key: "hrv_ms", label: "HRV", unit: "ms", decimals: 0, higher: true },
    { key: "rhr_bpm", label: "RHR", unit: "bpm", decimals: 0, higher: false },
    { key: "weight_kg", label: "Weight", unit: "kg", decimals: 1, higher: null },
    { key: "wellness", label: "Wellness avg", unit: "/5", decimals: 2, higher: true },
    { key: "steps", label: "Steps", unit: "", decimals: 0, higher: true },
    { key: "active_calories", label: "Active kcal", unit: "kcal", decimals: 0, higher: true },
    { key: "spo2_avg_pct", label: "SpO₂", unit: "%", decimals: 1, higher: true },
    { key: "body_fat_pct", label: "Body fat", unit: "%", decimals: 1, higher: null },
  ] as const;

  // Derived layer — keyed by date; one row per (user, date).
  const derivedByDate = new Map(derived.map((r) => [r.date, r] as const));
  const gateDays: GateStripDay[] = dates.map((d) => ({
    date: d,
    gate: derivedByDate.get(d)?.readiness_gate ?? null,
  }));
  const gateSamples = gateDays.filter((d) => d.gate != null).length;

  const sleepDebt = dates.map(
    (d) => derivedByDate.get(d)?.sleep_debt_7d_min ?? null,
  );
  const sleepDebtSamples = sleepDebt.filter((v) => v != null).length;

  const zRows = [
    { label: "HRV z", values: dates.map((d) => num(derivedByDate.get(d)?.hrv_z)) },
    { label: "RHR z", values: dates.map((d) => num(derivedByDate.get(d)?.rhr_z)) },
    { label: "Sleep z", values: dates.map((d) => num(derivedByDate.get(d)?.sleep_z)) },
  ].filter((r) => r.values.filter((v) => v != null).length >= 2);

  // Per-workout vendor metrics — sparse series, one point per run, date order.
  const metricsSorted = [...workoutMetrics].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const gctValues: number[] = [];
  for (const m of metricsSorted) {
    const left = num(m.gct_balance_pct_left);
    if (left != null) gctValues.push(Math.abs(left - 50) * 2);
  }
  const cadenceValues: number[] = [];
  for (const m of metricsSorted) {
    const c = num(m.cadence_spm);
    if (c != null) cadenceValues.push(c);
  }

  const vendorLoadByWorkout = new Map<string, number>();
  for (const m of workoutMetrics) {
    const load = num(m.vendor_training_load);
    if (load != null && load > 0) vendorLoadByWorkout.set(m.workout_id, load);
  }
  const weeks = weeklyLoadBuckets(workouts, vendorLoadByWorkout, startDate, endDate);
  const typeHours = hoursByCanonicalType(workouts);

  const showRecovery = gateSamples >= 2 || sleepDebtSamples >= 2 || zRows.length > 0;
  const showForm = gctValues.length >= 2 || cadenceValues.length >= 2;

  const anyData =
    daily.length > 0 ||
    workouts.length > 0 ||
    derived.length > 0 ||
    workoutMetrics.length > 0;

  if (!anyData) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
        No data in this window yet — trends appear once you have a few days of
        entries.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Daily metrics
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics
            .filter((m) => {
              // Wellness needs a few composite days to be meaningful — below
              // that threshold the card simply doesn't render.
              if (m.key === "wellness") {
                return (
                  series.wellness.filter((v) => v != null).length >=
                  MIN_WELLNESS_DAYS
                );
              }
              return series[m.key].some((v) => v != null);
            })
            .map((m) => (
              <MetricCard
                key={m.key}
                label={m.label}
                unit={m.unit}
                decimals={m.decimals}
                values={series[m.key]}
                baseline={baselines[m.key]}
                higherIsBetter={m.higher}
                latest={latestNonNull(series[m.key])}
              />
            ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Training load
        </h3>
        <div className="grid gap-3 lg:grid-cols-3">
          <WeeklyLoadCard weeks={weeks} />
          <TypeDistributionCard
            entries={typeHours.entries}
            totalHours={typeHours.totalHours}
          />
          <ConsistencyCard daily={daily} dates={dates} />
        </div>
      </section>

      {showRecovery ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Readiness &amp; recovery
          </h3>
          <div className="grid gap-3 lg:grid-cols-3">
            {gateSamples >= 2 ? <GateHistoryCard days={gateDays} /> : null}
            {sleepDebtSamples >= 2 ? (
              <SleepDebtCard
                values={sleepDebt}
                latest={latestNonNull(sleepDebt)}
              />
            ) : null}
            {zRows.length > 0 ? <ReadinessFactorsCard rows={zRows} /> : null}
          </div>
        </section>
      ) : null}

      {showForm ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Running form
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {gctValues.length >= 2 ? (
              <GctAsymmetryCard values={gctValues} />
            ) : null}
            {cadenceValues.length >= 2 ? (
              <CadenceCard values={cadenceValues} />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  unit,
  decimals,
  values,
  baseline,
  higherIsBetter,
  latest,
}: {
  label: string;
  unit: string;
  decimals: number;
  values: ReadonlyArray<number | null>;
  baseline: Baseline | null;
  higherIsBetter: boolean | null;
  latest: number | null;
}) {
  const cls = classify(latest, baseline, higherIsBetter);
  const samples = values.filter((v) => v != null).length;
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          n={samples}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl tabular-nums">
            {latest != null ? latest.toFixed(decimals) : "—"}
          </span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
        {baseline ? (
          <span
            className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${bandClass(cls.direction)}`}
            title={`baseline ${baseline.mean.toFixed(decimals)} ${unit} · sd ${baseline.sd.toFixed(decimals)}`}
          >
            {label === "Weight" ? "" : cls.band === "above" ? "above" : cls.band === "below" ? "below" : cls.band === "in" ? "in band" : "—"}
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-foreground/80">
        {samples >= 3 ? (
          <Sparkline
            values={values}
            baseline={baseline}
            width={260}
            height={56}
            ariaLabel={`${label} trend`}
          />
        ) : (
          <div className="flex h-14 items-center justify-center text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Need ≥3 days for trend
          </div>
        )}
      </div>
    </div>
  );
}

type WeekLoad = {
  weekStart: string;
  totalMin: number;
  /** Canonical type → intensity-weighted load for the week. */
  loadByType: Map<string, number>;
};

// Contiguous ISO weeks (Monday starts) covering [startDate, endDate]. Per
// workout, load = vendor_training_load when the connector provided one, else
// duration_min × (rpe ?? 5) — the TRIMP-lite fallback.
function weeklyLoadBuckets(
  workouts: ReadonlyArray<TrendsWorkout>,
  vendorLoadByWorkout: ReadonlyMap<string, number>,
  startDate: string,
  endDate: string,
): WeekLoad[] {
  const buckets: WeekLoad[] = [];
  const cursor = new Date(`${weekStart(startDate)}T00:00:00Z`);
  const last = new Date(`${weekStart(endDate)}T00:00:00Z`);
  while (cursor <= last) {
    buckets.push({
      weekStart: cursor.toISOString().slice(0, 10),
      totalMin: 0,
      loadByType: new Map(),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  const byWeek = new Map(buckets.map((b) => [b.weekStart, b] as const));
  for (const w of workouts) {
    const bucket = byWeek.get(weekStart(w.date));
    if (!bucket) continue;
    bucket.totalMin += w.duration_min ?? 0;
    const load =
      vendorLoadByWorkout.get(w.id) ?? (w.duration_min ?? 0) * (w.rpe ?? 5);
    if (load <= 0) continue;
    const key = normalizeType(w.type);
    bucket.loadByType.set(key, (bucket.loadByType.get(key) ?? 0) + load);
  }
  return buckets;
}

function WeeklyLoadCard({ weeks }: { weeks: ReadonlyArray<WeekLoad> }) {
  const totalMin = weeks.reduce((a, w) => a + w.totalMin, 0);
  const avgMinPerWeek = weeks.length > 0 ? totalMin / weeks.length : 0;
  const hasData = weeks.some((w) => w.totalMin > 0 || w.loadByType.size > 0);

  // Stable stack order: types by total load across the window, descending.
  const typeTotals = new Map<string, number>();
  for (const w of weeks) {
    for (const [t, v] of w.loadByType) {
      typeTotals.set(t, (typeTotals.get(t) ?? 0) + v);
    }
  }
  const typeOrder = Array.from(typeTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  const data = weeks.map((w) => ({
    x: w.weekStart,
    segments: typeOrder
      .map((t) => ({
        key: displayNameForType(t),
        value: w.loadByType.get(t) ?? 0,
        color: chartColorForType(t),
      }))
      .filter((s) => s.value > 0),
  }));

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Weekly load
        </span>
        <span className="text-[10px] text-muted-foreground">{weeks.length} wk</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-2xl tabular-nums">
          {hasData ? `~${Math.round(avgMinPerWeek)}` : "—"}
        </span>
        <span className="text-xs text-muted-foreground">
          min / wk avg · bars show load
        </span>
      </div>
      <div className="mt-3">
        <BarStack
          data={data}
          height={56}
          ariaLabel={`Weekly training load by type, ${weeks.length} weeks`}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{weeks[0]?.weekStart ?? ""}</span>
        <span>now</span>
      </div>
      {typeOrder.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {typeOrder.slice(0, 4).map((t) => (
            <span key={t} className="flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: chartColorForType(t) }}
              />
              {displayNameForType(t)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TypeDistributionCard({
  entries,
  totalHours,
}: {
  entries: ReadonlyArray<{ type: string; hours: number }>;
  totalHours: number;
}) {
  if (totalHours <= 0) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Workout types
        </span>
        <div className="mt-4 text-sm text-muted-foreground">No workout hours yet.</div>
      </div>
    );
  }
  const r = 28;
  const c = 2 * Math.PI * r;
  const segments = buildSegments(
    entries.map((e) => ({
      key: e.type,
      value: e.hours,
      color: chartColorForType(e.type),
    })),
    totalHours,
    c,
  );
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Workout types
        </span>
        <span className="text-[10px] text-muted-foreground">
          {totalHours.toFixed(1)} h total
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <svg viewBox="0 0 80 80" width={80} height={80} role="img" aria-label="Workout hours by type">
          <circle cx={40} cy={40} r={r} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={14} />
          {segments.map((s) => (
            <circle
              key={s.key}
              cx={40}
              cy={40}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={14}
              strokeDasharray={`${s.len} ${c - s.len}`}
              strokeDashoffset={-s.offset}
              transform="rotate(-90 40 40)"
            />
          ))}
        </svg>
        <ul className="flex-1 space-y-1 text-xs">
          {entries.slice(0, 6).map((e) => (
            <li key={e.type} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: chartColorForType(e.type) }}
                />
                <span>{displayNameForType(e.type)}</span>
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {e.hours.toFixed(1)} h
              </span>
            </li>
          ))}
          {entries.length > 6 ? (
            <li className="text-[10px] text-muted-foreground">
              +{entries.length - 6} more
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function ConsistencyCard({
  daily,
  dates,
}: {
  daily: ReadonlyArray<TrendsDaily>;
  dates: ReadonlyArray<string>;
}) {
  const filled = new Set(daily.map((d) => d.date));
  const recent = dates.slice(-28);
  const filledCount = recent.filter((d) => filled.has(d)).length;
  const pct = recent.length > 0 ? (filledCount / recent.length) * 100 : 0;
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Check-in consistency
        </span>
        <span className="text-[10px] text-muted-foreground">last 28 d</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-2xl tabular-nums">{Math.round(pct)}</span>
        <span className="text-xs text-muted-foreground">% days logged</span>
      </div>
      <div
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.min(recent.length, 14)}, minmax(0, 1fr))` }}
        role="img"
        aria-label="Daily check-in pattern, last 28 days"
      >
        {recent.map((d) => (
          <div
            key={d}
            className={`aspect-square rounded-[3px] ${
              filled.has(d) ? "bg-emerald-500/70" : "bg-muted"
            }`}
            title={`${d}${filled.has(d) ? " · logged" : ""}`}
          />
        ))}
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        {filledCount} of {recent.length} days
      </div>
    </div>
  );
}

function GateHistoryCard({ days }: { days: ReadonlyArray<GateStripDay> }) {
  const counts = { green: 0, amber: 0, red: 0 };
  for (const d of days) {
    if (d.gate) counts[d.gate] += 1;
  }
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Gate history
        </span>
        <span className="text-[10px] text-muted-foreground">{days.length} d</span>
      </div>
      <div className="mt-3">
        <GateStrip days={days} size="md" />
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        {counts.green} G · {counts.amber} A · {counts.red} R
      </div>
    </div>
  );
}

function SleepDebtCard({
  values,
  latest,
}: {
  values: ReadonlyArray<number | null>;
  latest: number | null;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sleep debt
        </span>
        <span className="text-[10px] text-muted-foreground">7-d rolling</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-2xl tabular-nums">
          {latest != null ? Math.round(latest) : "—"}
        </span>
        <span className="text-xs text-muted-foreground">min</span>
      </div>
      <div className="mt-3 text-foreground/80">
        <Sparkline
          values={values}
          width={260}
          height={56}
          fillArea
          refLines={[{ y: 180, label: "180m", tone: "warn" }]}
          ariaLabel="7-day rolling sleep debt"
        />
      </div>
    </div>
  );
}

function ReadinessFactorsCard({
  rows,
}: {
  rows: ReadonlyArray<{ label: string; values: ReadonlyArray<number | null> }>;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Readiness factors
        </span>
        <span className="text-[10px] text-muted-foreground">z-scores</span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {r.label}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {formatZ(latestNonNull(r.values)) ?? "—"}
              </span>
            </div>
            <div className="text-foreground/80">
              <Sparkline
                values={r.values}
                width={260}
                height={28}
                yDomain={[-3, 3]}
                refLines={[{ y: 0 }]}
                ariaLabel={`${r.label} trend`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GctAsymmetryCard({ values }: { values: ReadonlyArray<number> }) {
  const latest = latestNonNull(values);
  const yMax = Math.max(6, Math.max(...values) + 1);
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          GCT asymmetry
        </span>
        <span className="text-[10px] text-muted-foreground">
          injury watch · {values.length} runs
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-2xl tabular-nums">
          {latest != null ? latest.toFixed(1) : "—"}
        </span>
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      <div className="mt-3 text-foreground/80">
        <Sparkline
          values={values}
          width={260}
          height={56}
          yDomain={[0, yMax]}
          refLines={[{ y: 5, label: "5%", tone: "warn" }]}
          ariaLabel="Ground-contact-time asymmetry per run"
        />
      </div>
    </div>
  );
}

function CadenceCard({ values }: { values: ReadonlyArray<number> }) {
  const latest = latestNonNull(values);
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cadence
        </span>
        <span className="text-[10px] text-muted-foreground">{values.length} runs</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-2xl tabular-nums">
          {latest != null ? Math.round(latest) : "—"}
        </span>
        <span className="text-xs text-muted-foreground">spm</span>
      </div>
      <div className="mt-3 text-foreground/80">
        <Sparkline
          values={values}
          width={260}
          height={56}
          ariaLabel="Running cadence per run"
        />
      </div>
    </div>
  );
}

function buildSegments(
  items: ReadonlyArray<{ key: string; value: number; color: string }>,
  total: number,
  circumference: number,
): Array<{ key: string; color: string; len: number; offset: number }> {
  const out: Array<{ key: string; color: string; len: number; offset: number }> = [];
  let cursor = 0;
  for (const it of items) {
    const frac = total > 0 ? it.value / total : 0;
    const len = frac * circumference;
    out.push({ key: it.key, color: it.color, len, offset: cursor });
    cursor += len;
  }
  return out;
}

// A day's wellness composite is only meaningful when most of the six scales
// are filled. Requiring >= 3 stops a phantom "4.0 / 5" from rendering as the
// hero metric just because mood and fatigue happened to be jotted down once.
const MIN_SCALES_PER_DAY = 3;
// And we need at least 3 such days before showing a wellness trend at all.
const MIN_WELLNESS_DAYS = 3;

function wellnessComposite(d: TrendsDaily | undefined): number | null {
  if (!d) return null;
  const xs = [d.fatigue, d.soreness, d.mood, d.stress, d.motivation, d.sleep_quality]
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (xs.length < MIN_SCALES_PER_DAY) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Hours per canonical workout type, consolidated through normalizeType so
// "run" and "running" merge. Sorted descending by hours.
function hoursByCanonicalType(workouts: ReadonlyArray<TrendsWorkout>): {
  entries: Array<{ type: string; hours: number }>;
  totalHours: number;
} {
  const map = new Map<string, number>();
  let totalMin = 0;
  for (const w of workouts) {
    const min = w.duration_min ?? 0;
    if (min <= 0) continue;
    const key = normalizeType(w.type);
    map.set(key, (map.get(key) ?? 0) + min);
    totalMin += min;
  }
  const entries = Array.from(map.entries())
    .map(([type, min]) => ({ type, hours: min / 60 }))
    .sort((a, b) => b.hours - a.hours);
  return { entries, totalHours: totalMin / 60 };
}

function num(s: string | null | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function latestNonNull(values: ReadonlyArray<number | null>): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}
