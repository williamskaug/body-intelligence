import Link from "next/link";
import { Sparkline } from "@/components/data/sparkline";
import {
  datesInRange,
  groupByDate,
  macroTotals,
  weeklyBuckets,
} from "@/lib/data-display/aggregate";
import {
  computeBaseline,
  classify,
  bandClass,
  type Baseline,
} from "@/lib/data-display/baseline";
import { chartColorForType } from "@/lib/data-display/workout-types";

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
  date: string;
  type: string;
  duration_min: number | null;
  rpe: number | null;
};

export type TrendsMeal = {
  eaten_at: string;
  calories: number | null;
  protein_g: string | null;
  carbs_g: string | null;
  fat_g: string | null;
};

type Props = {
  daily: ReadonlyArray<TrendsDaily>;
  workouts: ReadonlyArray<TrendsWorkout>;
  meals: ReadonlyArray<TrendsMeal>;
  startDate: string;
  endDate: string;
};

export function Trends({ daily, workouts, meals, startDate, endDate }: Props) {
  // Align daily to a contiguous date axis so gaps render as gaps in the line.
  const dates = datesInRange(startDate, endDate);
  const dailyByDate = groupByDate(daily as Array<{ date: string } & TrendsDaily>);

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

  const totals = macroTotals(meals);
  const weeks = weeklyBuckets(workouts as TrendsWorkout[], 12, endDate);
  const typeCounts = countByType(workouts);
  const distinctMealDays = new Set(meals.map((m) => m.eaten_at.slice(0, 10))).size;

  const anyData =
    daily.length > 0 || workouts.length > 0 || meals.length > 0;

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
              // Wellness has special "need at least 3 days" rules — the empty
              // card takes its slot in the grid below. Other metrics still
              // render if they have any data.
              if (m.key === "wellness") {
                return true;
              }
              return series[m.key].some((v) => v != null);
            })
            .map((m) => {
              if (m.key === "wellness") {
                const samples = series.wellness.filter((v) => v != null).length;
                if (samples < MIN_WELLNESS_DAYS) {
                  return <WellnessEmpty key={m.key} samples={samples} />;
                }
              }
              return (
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
              );
            })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Training load
        </h3>
        <div className="grid gap-3 lg:grid-cols-3">
          <WeeklyVolumeCard weeks={weeks} />
          <TypeDistributionCard counts={typeCounts} />
          <ConsistencyCard daily={daily} dates={dates} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nutrition
        </h3>
        <MacroCard totals={totals} dayCount={distinctMealDays} />
      </section>
    </div>
  );
}

function WellnessEmpty({ samples }: { samples: number }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Wellness avg
        </span>
        <span className="text-[10px] text-muted-foreground">
          {samples === 0 ? "no data" : `${samples} day${samples === 1 ? "" : "s"}`}
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground/80">
        Daily wellness scales not yet logged on ≥3 days with ≥3 fields each.
      </p>
      <Link
        href="/agents?id=morning-checkin"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
      >
        Install morning check-in →
      </Link>
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

function WeeklyVolumeCard({
  weeks,
}: {
  weeks: ReadonlyArray<{ weekStart: string; totalMin: number; trimp: number }>;
}) {
  const maxLoad = Math.max(1, ...weeks.map((w) => w.trimp));
  const totalMin = weeks.reduce((a, w) => a + w.totalMin, 0);
  const avgMinPerWeek = weeks.length > 0 ? totalMin / weeks.length : 0;
  const hasData = weeks.some((w) => w.totalMin > 0);
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Weekly load
        </span>
        <span className="text-[10px] text-muted-foreground">last 12 wk</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-2xl tabular-nums">
          {hasData ? Math.round(avgMinPerWeek) : "—"}
        </span>
        <span className="text-xs text-muted-foreground">min / wk avg</span>
      </div>
      <div
        className="mt-3 flex h-14 items-end gap-1"
        role="img"
        aria-label="Weekly training load, last 12 weeks"
      >
        {weeks.map((w) => {
          const h = w.trimp === 0 ? 0 : Math.max(2, (w.trimp / maxLoad) * 56);
          return (
            <div
              key={w.weekStart}
              className="flex-1 rounded-sm bg-foreground/80"
              style={{ height: `${h}px` }}
              title={`Week of ${w.weekStart}: ${Math.round(w.totalMin)} min · TRIMP ${Math.round(w.trimp)}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{weeks[0]?.weekStart ?? ""}</span>
        <span>now</span>
      </div>
    </div>
  );
}

function TypeDistributionCard({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  if (total === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Workout types
        </span>
        <div className="mt-4 text-sm text-muted-foreground">No workouts yet.</div>
      </div>
    );
  }
  const r = 28;
  const c = 2 * Math.PI * r;
  const segments = buildSegments(
    entries.map(([type, n]) => ({ key: type, value: n, color: chartColorForType(type) })),
    total,
    c,
  );
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Workout types
        </span>
        <span className="text-[10px] text-muted-foreground">{total} total</span>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <svg viewBox="0 0 80 80" width={80} height={80} role="img" aria-label="Workout type distribution">
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
          {entries.slice(0, 6).map(([type, n]) => (
            <li key={type} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: chartColorForType(type) }}
                />
                <span>{type}</span>
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">{n}</span>
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

function MacroCard({
  totals,
  dayCount,
}: {
  totals: ReturnType<typeof macroTotals>;
  dayCount: number;
}) {
  const sumMacroG = totals.protein_g + totals.carbs_g + totals.fat_g;
  const slices: Array<{ label: string; grams: number; color: string }> = [
    { label: "Protein", grams: totals.protein_g, color: "hsl(15 80% 55%)" },
    { label: "Carbs", grams: totals.carbs_g, color: "hsl(45 85% 55%)" },
    { label: "Fat", grams: totals.fat_g, color: "hsl(190 70% 50%)" },
  ];
  const totalMeals = totals.mealsWithMacros + totals.mealsDescriptionOnly;
  const avgKcal = dayCount > 0 ? totals.calories / dayCount : 0;
  // Only render a kcal average when the sample is large enough that the number
  // is meaningful. One logged day of one logged meal is not a 30-day average.
  const showAvgKcal =
    dayCount >= MIN_MACRO_DAYS && totals.mealsWithMacros >= MIN_MACRO_MEALS;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Avg kcal / logged day
        </span>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-mono text-2xl tabular-nums">
            {showAvgKcal ? Math.round(avgKcal) : "—"}
          </span>
          <span className="text-xs text-muted-foreground">kcal</span>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {totalMeals === 0
            ? "No meals logged."
            : showAvgKcal
              ? `${totalMeals} meal${totalMeals === 1 ? "" : "s"} on ${dayCount} day${dayCount === 1 ? "" : "s"} · ${totals.mealsWithMacros} with macros`
              : `Need ≥${MIN_MACRO_DAYS} days with ≥${MIN_MACRO_MEALS} macro-logged meals (have ${dayCount}d / ${totals.mealsWithMacros}m).`}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Macro split
          </span>
          <span className="text-[10px] text-muted-foreground">
            of {Math.round(sumMacroG)} g logged
          </span>
        </div>
        {sumMacroG === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">
            No macro data logged in this window.
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-4">
            <MacroPie slices={slices} total={sumMacroG} />
            <ul className="flex-1 space-y-1 text-xs">
              {slices.map((s) => {
                const pct = sumMacroG > 0 ? (s.grams / sumMacroG) * 100 : 0;
                return (
                  <li key={s.label} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span>{s.label}</span>
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {Math.round(s.grams)} g · {pct.toFixed(0)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function MacroPie({
  slices,
  total,
}: {
  slices: ReadonlyArray<{ label: string; grams: number; color: string }>;
  total: number;
}) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const segments = buildSegments(
    slices.map((s) => ({ key: s.label, value: s.grams, color: s.color })),
    total,
    c,
  );
  return (
    <svg viewBox="0 0 80 80" width={80} height={80} role="img" aria-label="Macro split">
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
// Same idea for nutrition — one logged meal-day isn't an average.
const MIN_MACRO_DAYS = 3;
const MIN_MACRO_MEALS = 3;

function wellnessComposite(d: TrendsDaily | undefined): number | null {
  if (!d) return null;
  const xs = [d.fatigue, d.soreness, d.mood, d.stress, d.motivation, d.sleep_quality]
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (xs.length < MIN_SCALES_PER_DAY) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function countByType(workouts: ReadonlyArray<TrendsWorkout>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of workouts) {
    const k = w.type.trim().toLowerCase() || "other";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
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
