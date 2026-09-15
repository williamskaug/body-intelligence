import Link from "next/link";
import { EmptyNote, Panel, PanelHeader } from "@/components/app/panel";
import { SvgBars, SvgHBars, SvgLine, SvgStackedWeekly } from "@/components/app/charts";
import { Sparkline } from "@/components/data/sparkline";
import { CorrelationHeatmap } from "@/components/data/charts/correlation-heatmap";
import {
  BaselineBandChart,
  HistogramChart,
  MultiSeriesLine,
  PerformanceManagementChart,
  RatioBandChart,
  ScatterRegression,
} from "@/components/analyze/lazy-charts";
import { GateStrip } from "@/components/data/gate-strip";
import { addDays } from "@/lib/app/dates";
import { formatClock, formatHours, formatKm, formatPace, num, paceFromWorkout } from "@/lib/app/format";
import type { AppSnapshot } from "@/lib/app/snapshot";
import {
  hoursBySport,
  isLongRun,
  isRideType,
  isRunType,
  runningEfficiency,
  weeklyRampPct,
  weeklyVolume,
  workoutTitle,
} from "@/lib/app/training";
import { weekStart } from "@/lib/data-display/aggregate";
import { computeBaseline } from "@/lib/data-display/baseline";
import type { Gate } from "@/lib/data-display/derived";
import { metricLabel } from "@/lib/data-display/metric-registry";
import { cn } from "@/lib/utils";
import type { getLoadBalance } from "@/lib/mcp/tools/get-load-balance";

export const ANALYZE_TABS = [
  { id: "build", label: "Build" },
  { id: "fitness", label: "Fitness" },
  { id: "long-run", label: "Long run" },
  { id: "intensity", label: "Intensity" },
  { id: "form", label: "Form" },
  { id: "recovery", label: "Recovery" },
  { id: "stats", label: "Stats" },
] as const;

export type AnalyzeTab = (typeof ANALYZE_TABS)[number]["id"];

export function parseAnalyzeTab(raw: string | undefined): AnalyzeTab {
  if (ANALYZE_TABS.some((t) => t.id === raw)) return raw as AnalyzeTab;
  return "build";
}

export type AnalyzeExtras = {
  load: Awaited<ReturnType<typeof getLoadBalance>> | null;
  matrix: {
    metrics: string[];
    matrix: Array<Array<number | null>>;
    n: Array<Array<number>>;
  } | null;
  capacitySeries: { dates: string[]; series: Record<string, Array<number | null>> } | null;
  recoveryBase: { dates: string[]; series: Record<string, Array<number | null>> } | null;
  dists: Array<{
    metric: string;
    histogram: { edges: number[]; counts: number[] } | null;
    percentiles: { p5: number | null; p50: number | null; p95: number | null };
    latest: number | null;
  } | null>;
  sleepHrv: {
    points: Array<{ x: number; y: number; date: string }>;
    line: { x1: number; y1: number; x2: number; y2: number } | null;
    stats: { r: number | null; r2: number | null; slope: number | null; n: number };
  } | null;
  insightLead: string | null;
  insightPath: string | null;
};

export function AnalyzeView({
  snapshot,
  tab,
  extras,
}: {
  snapshot: AppSnapshot;
  tab: AnalyzeTab;
  extras: AnalyzeExtras;
}) {
  return (
    <div>
      {extras.insightLead ? (
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-3 py-2 text-[12px]">
          <span className="border border-neutral-300 px-1.5 py-px text-[10px] uppercase tracking-wide text-neutral-500">
            Insight
          </span>
          <p className="min-w-0 flex-1 text-[12px] leading-snug [overflow-wrap:anywhere]">{extras.insightLead}</p>
          {extras.insightPath ? (
            <Link
              href={`/memory?path=${encodeURIComponent(extras.insightPath)}`}
              className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-500 hover:text-foreground"
            >
              Read →
            </Link>
          ) : null}
        </div>
      ) : null}
      {tab === "build" ? <BuildTab snapshot={snapshot} extras={extras} /> : null}
      {tab === "fitness" ? <FitnessTab snapshot={snapshot} extras={extras} /> : null}
      {tab === "long-run" ? <LongRunTab snapshot={snapshot} /> : null}
      {tab === "intensity" ? <IntensityTab snapshot={snapshot} /> : null}
      {tab === "form" ? <FormTab snapshot={snapshot} /> : null}
      {tab === "recovery" ? <RecoveryTab snapshot={snapshot} extras={extras} /> : null}
      {tab === "stats" ? <StatsTab extras={extras} /> : null}
    </div>
  );
}

function BuildTab({ snapshot, extras }: { snapshot: AppSnapshot; extras: AnalyzeExtras }) {
  const weeks = weeklyVolume(
    snapshot.allWorkouts.map((w) => ({
      ...w,
      vendor_training_load: snapshot.metricsByWorkoutId[w.id]?.vendor_training_load,
    })),
    snapshot.todayDate,
    16,
  );
  const thisW = weeks[weeks.length - 1];
  const sports = hoursBySport(snapshot.allWorkouts.filter((w) => w.date >= weekStart(snapshot.todayDate)));
  const ramps = weeklyRampPct(weeks);
  const pmc = (extras.load?.series ?? []).map((s) => ({ date: s.date, ctl: s.ctl, atl: s.atl, tsb: s.tsb }));
  const stacked = (["run", "ride", "strength", "golf"] as const).map((t) =>
    weeks.map((w) => {
      if (t === "run") return w.runHours;
      if (t === "ride") return w.rideHours;
      if (t === "strength") return w.strengthHours;
      return w.golfHours;
    }),
  );

  return (
    <div className="grid gap-px bg-neutral-200">
      <div className="grid gap-px @5xl:grid-cols-[1.4fr_0.7fr]">
        <Panel>
          <PanelHeader
            title="Weekly volume"
            hint="Run kilometres (bars). Ceiling band is descriptive."
            extra={`${thisW ? formatKm(thisW.runKm, 0) : "—"} km · ${thisW ? formatHours(thisW.aerobicHours) : "—"} h`}
          />
          <div className="px-2 pt-2">
            <SvgBars
              values={weeks.map((w) => w.runKm)}
              labels={weeks.map((w) => w.label)}
              currentIndex={weeks.length - 1}
              height={160}
            />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Hours by sport" extra={`wk ${thisW?.label ?? ""}`} />
          <SvgHBars
            rows={["run", "ride", "strength", "golf"].map((t) => ({
              label: t,
              value: sports.find((s) => s.type === t)?.hours ?? 0,
              max: Math.max(...sports.map((s) => s.hours), 1),
            }))}
          />
        </Panel>
      </div>
      <div className="grid gap-px @5xl:grid-cols-3">
        <Panel>
          <PanelHeader title="Ramp compliance" hint="Week-over-week change in run km." />
          <div className="flex h-40 items-end gap-1 px-3 py-3">
            {ramps.map((r, i) => (
              <div key={weeks[i]!.weekStart} className="flex flex-1 flex-col items-center justify-end">
                <div
                  className="w-full bg-neutral-800"
                  style={{ height: `${r == null ? 4 : Math.min(100, Math.abs(r) * 2)}%` }}
                  title={`${weeks[i]!.label}: ${r == null ? "—" : `${r.toFixed(0)}%`}`}
                />
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Sessions by type" />
          <div className="px-2 pt-2">
            <SvgStackedWeekly
              series={stacked}
              labels={weeks.map((w) => w.label.replace("W", ""))}
              currentIndex={weeks.length - 1}
              height={140}
              colors={["#171717", "#2563eb", "#a3a3a3", "#d4d4d4"]}
            />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Load balance" />
          <div className="p-2">
            <PerformanceManagementChart data={pmc} ramp={extras.load?.current.ctl_ramp_7d ?? null} minDays={10} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function FitnessTab({ snapshot, extras }: { snapshot: AppSnapshot; extras: AnalyzeExtras }) {
  const runs = snapshot.allWorkouts.filter((w) => isRunType(w.type));
  const efs = runs
    .map((w) => ({
      date: w.date,
      ef: runningEfficiency(num(w.distance_km), w.duration_min, w.avg_hr),
    }))
    .filter((x): x is { date: string; ef: number } => x.ef != null);
  const latestEf = efs[0]?.ef ?? null;
  const yearAgo = efs.find((e) => e.date <= addDays(snapshot.todayDate, -300))?.ef;
  const vo2 = extras.capacitySeries?.series["capacity_vo2max_running"] ?? [];
  const vo2Dates = extras.capacitySeries?.dates ?? [];
  const marathon = extras.capacitySeries?.series["capacity_race_pred_marathon_s"] ?? [];
  const pred5 = latestNonNull(extras.capacitySeries?.series["capacity_race_pred_5k_s"]);
  const pred10 = latestNonNull(extras.capacitySeries?.series["capacity_race_pred_10k_s"]);
  const predH = latestNonNull(extras.capacitySeries?.series["capacity_race_pred_half_s"]);
  const lthr = snapshot.thresholds?.run.lthr;
  const ltPace = snapshot.thresholds?.run.thresholdPace;
  const ftp = snapshot.thresholds?.bike.ftp;
  const lastQual = runs.find(
    (w) => /threshold|4\s*[×x]|interval/i.test(w.notes ?? "") || (w.rpe ?? 0) >= 7,
  );
  const rideH =
    snapshot.allWorkouts
      .filter((w) => isRideType(w.type) && w.date >= addDays(snapshot.todayDate, -21))
      .reduce((a, w) => a + (w.duration_min ?? 0), 0) / 60;

  return (
    <div className="grid gap-px bg-neutral-200">
      <div className="grid gap-px @5xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Efficiency factor" extra="12 mo" hint="Distance (m) / (avg HR × minutes)." />
          <SvgLine
            points={efs
              .slice()
              .reverse()
              .map((e) => ({ x: e.date, y: e.ef }))}
            height={180}
            stroke="#2563eb"
          />
          <p className="px-3 pb-2 text-[11px] text-neutral-500">
            {latestEf != null ? `${latestEf.toFixed(2)} now` : "—"}
            {yearAgo != null && latestEf != null
              ? ` · ${yearAgo.toFixed(2)} a year ago · ${(((latestEf - yearAgo) / yearAgo) * 100).toFixed(1)}%`
              : ""}
          </p>
        </Panel>
        <Panel>
          <PanelHeader title="Race predictions vs goal" />
          <SvgLine
            points={(extras.capacitySeries?.dates ?? []).map((d, i) => ({ x: d, y: marathon[i] ?? null }))}
            height={180}
            yFormat={(v) => formatClock(v)}
            refs={
              snapshot.race?.goalSeconds != null
                ? [{ y: snapshot.race.goalSeconds, color: "#e11d48", dash: true }]
                : []
            }
          />
          <p className="px-3 pb-2 font-mono text-[11px] text-neutral-500">
            {snapshot.race?.goalSeconds != null ? `goal ${formatClock(snapshot.race.goalSeconds)}` : "no A-race goal"}
            {pred5 != null ? ` · 5k ${formatClock(pred5)}` : ""}
            {pred10 != null ? ` · 10k ${formatClock(pred10)}` : ""}
            {predH != null ? ` · HM ${formatClock(predH)}` : ""}
          </p>
        </Panel>
      </div>
      <div className="grid gap-px @5xl:grid-cols-3">
        <Panel>
          <PanelHeader title="VO₂max" />
          <div className="p-2">
            <MultiSeriesLine
              data={vo2Dates.map((date, i) => ({ date, vo2: vo2[i] ?? null }))}
              series={[{ key: "vo2", label: "VO₂max", color: "#171717", axis: "left" }]}
              minN={3}
            />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Threshold anchor" href="/memory?path=THRESHOLDS.md" hrefLabel="THRESHOLDS.md" />
          <dl className="grid grid-cols-2 gap-2 px-3 py-2 text-[12px]">
            <KV k="LTHR" v={lthr != null ? `${lthr} bpm` : "—"} />
            <KV k="LT pace" v={ltPace ?? "—"} />
            <KV
              k="Last quality"
              v={
                lastQual
                  ? `${formatPace(paceFromWorkout(num(lastQual.distance_km), lastQual.duration_min))} @ ${lastQual.avg_hr ?? "—"}`
                  : "—"
              }
            />
            <KV k="FTP" v={ftp != null ? `${ftp} W` : "—"} />
          </dl>
        </Panel>
        <Panel>
          <PanelHeader title="Ride hours → EF" extra="lag 3 wk" />
          <p className="px-3 py-2 text-[12px] text-neutral-500">
            Last 3 weeks of riding: {formatHours(rideH)} h. EF now {latestEf != null ? latestEf.toFixed(2) : "—"}.
          </p>
          <div className="px-3 pb-3">
            <Sparkline values={efs.slice().reverse().map((e) => e.ef)} width={640} height={80} stroke="#2563eb" className="w-full" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function LongRunTab({ snapshot }: { snapshot: AppSnapshot }) {
  const longs = snapshot.allWorkouts.filter(isLongRun);
  return (
    <div className="grid gap-px bg-neutral-200 @5xl:grid-cols-[1.4fr_0.7fr]">
      <Panel>
        <PanelHeader
          title="Long-run progression"
          extra="12 wk"
          hint="Long runs are sessions ≥16 km or ≥75 min."
        />
        <SvgBars
          values={longs
            .slice()
            .reverse()
            .slice(-12)
            .map((w) => num(w.distance_km) ?? 0)}
          labels={longs
            .slice()
            .reverse()
            .slice(-12)
            .map((w) => w.date.slice(5))}
          height={180}
        />
      </Panel>
      <Panel>
        <PanelHeader title="Durability" hint="HR-pace decoupling on long runs." />
        <SvgLine
          points={longs
            .slice()
            .reverse()
            .map((w) => ({
              x: w.date,
              y: num(snapshot.metricsByWorkoutId[w.id]?.decoupling_pct),
            }))}
          height={180}
          refs={[{ y: 5, color: "#e11d48", dash: true }]}
        />
      </Panel>
      <Panel className="min-w-0 @5xl:col-span-2">
        <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-[12px]">
          <thead className="text-[10px] uppercase tracking-wide text-neutral-400">
            <tr>
              {["Date", "Title", "Km", "Avg HR", "Pace", "Decoupling", "Cadence", "Weather", "Note"].map((h) => (
                <th key={h} className="px-2 py-1.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {longs.slice(0, 12).map((w) => {
              const m = snapshot.metricsByWorkoutId[w.id];
              return (
                <tr key={w.id} className="border-t border-neutral-100">
                  <td className="px-2 py-1 font-mono">{w.date}</td>
                  <td className="px-2 py-1">{workoutTitle(w)}</td>
                  <td className="px-2 py-1 font-mono">{formatKm(num(w.distance_km))}</td>
                  <td className="px-2 py-1 font-mono">{w.avg_hr ?? "—"}</td>
                  <td className="px-2 py-1 font-mono">
                    {formatPace(paceFromWorkout(num(w.distance_km), w.duration_min))}
                  </td>
                  <td className="px-2 py-1 font-mono">
                    {num(m?.decoupling_pct) != null ? `${num(m?.decoupling_pct)!.toFixed(1)} %` : "—"}
                  </td>
                  <td className="px-2 py-1 font-mono">{num(m?.cadence_spm)?.toFixed(0) ?? "—"}</td>
                  <td className="px-2 py-1 font-mono">
                    {num(m?.weather_temp_c) != null ? `${num(m?.weather_temp_c)!.toFixed(0)} °C` : "—"}
                  </td>
                  <td className="max-w-[14rem] truncate px-2 py-1 text-neutral-500">{w.notes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {longs.length === 0 ? <EmptyNote>No long runs in this window.</EmptyNote> : null}
      </Panel>
    </div>
  );
}

function IntensityTab({ snapshot }: { snapshot: AppSnapshot }) {
  const weeks = weeklyVolume(snapshot.allWorkouts, snapshot.todayDate, 16);
  const zoneWeeks = weeks.map((w) => {
    const z = [0, 0, 0, 0, 0];
    for (const workout of snapshot.allWorkouts) {
      if (weekStart(workout.date) !== w.weekStart) continue;
      const row = snapshot.zonesByWorkoutId[workout.id];
      if (!row) continue;
      z[0] += row.hr_z1_s ?? 0;
      z[1] += row.hr_z2_s ?? 0;
      z[2] += row.hr_z3_s ?? 0;
      z[3] += row.hr_z4_s ?? 0;
      z[4] += row.hr_z5_s ?? 0;
    }
    return z;
  });
  const totals = [0, 0, 0, 0, 0];
  for (const z of zoneWeeks) z.forEach((v, i) => (totals[i]! += v));
  const tot = totals.reduce((a, b) => a + b, 0);
  const runMax = maxHr(snapshot, (w) => isRunType(w.type));
  const rideMax = maxHr(snapshot, (w) => isRideType(w.type));
  const quality = snapshot.allWorkouts.filter((w) => {
    const z = snapshot.zonesByWorkoutId[w.id];
    const hard = (z?.hr_z4_s ?? 0) + (z?.hr_z5_s ?? 0);
    return hard >= 8 * 60 || (w.rpe ?? 0) >= 7;
  });
  const polar = (pred: (w: AppSnapshot["workouts"][number]) => boolean) => {
    let easy = 0;
    let mid = 0;
    let hard = 0;
    for (const w of snapshot.allWorkouts) {
      if (!pred(w)) continue;
      const z = snapshot.zonesByWorkoutId[w.id];
      if (!z) continue;
      easy += (z.hr_z1_s ?? 0) + (z.hr_z2_s ?? 0);
      mid += z.hr_z3_s ?? 0;
      hard += (z.hr_z4_s ?? 0) + (z.hr_z5_s ?? 0);
    }
    return { easy, mid, hard };
  };

  return (
    <div className="grid gap-px bg-neutral-200">
      <div className="grid gap-px @5xl:grid-cols-[1.4fr_0.7fr]">
        <Panel>
          <PanelHeader title="Time in zone" extra={runMax != null ? `HRmax ${runMax}` : undefined} />
          <SvgStackedWeekly
            series={[0, 1, 2, 3, 4].map((i) => zoneWeeks.map((z) => z[i]! / 60))}
            labels={weeks.map((w) => w.label)}
            currentIndex={weeks.length - 1}
            height={180}
            colors={["#e5e5e5", "#93c5fd", "#86efac", "#fbbf24", "#f87171"]}
          />
        </Panel>
        <Panel>
          <PanelHeader title="Polarization" />
          {(["run", "ride", "all"] as const).map((k) => {
            const p =
              k === "run"
                ? polar((w) => isRunType(w.type))
                : k === "ride"
                  ? polar((w) => isRideType(w.type))
                  : polar(() => true);
            const t = p.easy + p.mid + p.hard || 1;
            return (
              <div key={k} className="px-3 py-2">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-400">{k}</div>
                <div className="flex h-8 overflow-hidden">
                  <div className="bg-neutral-900" style={{ width: `${(p.easy / t) * 100}%` }} />
                  <div className="bg-neutral-500" style={{ width: `${(p.mid / t) * 100}%` }} />
                  <div className="bg-neutral-300" style={{ width: `${(p.hard / t) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </Panel>
      </div>
      <div className="grid gap-px @5xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Quality sessions" />
          <SvgBars
            values={weeks.map((w) => quality.filter((q) => weekStart(q.date) === w.weekStart).length)}
            labels={weeks.map((w) => w.label)}
            currentIndex={weeks.length - 1}
            height={120}
          />
        </Panel>
        <Panel>
          <PanelHeader title="Calibration" hint="Observed max HR in the window." />
          <dl className="grid grid-cols-2 gap-2 px-3 py-3 text-[12px]">
            <KV k="HRmax run" v={runMax != null ? String(runMax) : "—"} />
            <KV k="HRmax ride" v={rideMax != null ? String(rideMax) : "—"} />
          </dl>
          <p className="px-3 pb-3 text-[11px] text-neutral-500">
            {tot > 0
              ? `${Math.round(((totals[0]! + totals[1]!) / tot) * 100)}% easy (Z1–2) this window.`
              : "No HR-zone rows yet — run backfill to light this up."}
          </p>
        </Panel>
      </div>
    </div>
  );
}

function FormTab({ snapshot }: { snapshot: AppSnapshot }) {
  const runs = snapshot.allWorkouts.filter((w) => isRunType(w.type));
  const gct = runs.map((w) => snapshot.metricsByWorkoutId[w.id]?.gct_ms ?? null);
  const vr = runs.map((w) => num(snapshot.metricsByWorkoutId[w.id]?.vertical_ratio_pct));
  const stride = runs.map((w) => num(snapshot.metricsByWorkoutId[w.id]?.stride_len_m));
  const strength = snapshot.allWorkouts.filter((w) => w.type.toLowerCase().includes("strength"));
  const vol = strength.reduce(
    (a, w) => a + (num(snapshot.metricsByWorkoutId[w.id]?.strength_volume_kg) ?? 0),
    0,
  );
  const open = snapshot.events.filter((e) => !e.resolved_date);

  return (
    <div className="grid gap-px bg-neutral-200">
      <div className="grid gap-px @5xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Cadence" extra="target 170–175" />
          <SvgLine
            points={runs
              .slice()
              .reverse()
              .map((w) => ({
                x: w.date,
                y: num(snapshot.metricsByWorkoutId[w.id]?.cadence_spm),
              }))}
            height={180}
            refs={[
              { y: 170, color: "#a3a3a3", dash: true },
              { y: 175, color: "#a3a3a3", dash: true },
            ]}
          />
        </Panel>
        <Panel>
          <PanelHeader title="Ground contact & vertical ratio" />
          <div className="p-2">
            <MultiSeriesLine
              data={runs
                .slice()
                .reverse()
                .map((w, i) => ({
                  date: w.date,
                  gct: gct[runs.length - 1 - i] ?? null,
                  vr: vr[runs.length - 1 - i] ?? null,
                }))}
              series={[
                { key: "gct", label: "GCT ms", color: "#171717", axis: "left" },
                { key: "vr", label: "VR %", color: "#2563eb", axis: "right" },
              ]}
              minN={4}
            />
          </div>
        </Panel>
      </div>
      <div className="grid gap-px @5xl:grid-cols-3">
        <Panel>
          <PanelHeader title="Cadence vs pace" />
          <EmptyNote>
            {runs.filter((w) => num(snapshot.metricsByWorkoutId[w.id]?.cadence_spm) != null).length} runs
            with cadence in window.
          </EmptyNote>
        </Panel>
        <Panel>
          <PanelHeader title="Stride length" />
          <SvgLine
            points={runs
              .slice()
              .reverse()
              .map((w, i) => ({ x: w.date, y: stride[runs.length - 1 - i] ?? null }))}
            height={140}
          />
        </Panel>
        <Panel>
          <PanelHeader title="Strength & tissue" />
          <dl className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px]">
            <KV
              k="Strength / wk"
              v={`${strength.length} · ${formatHours(strength.reduce((a, w) => a + (w.duration_min ?? 0), 0) / 60)} h`}
            />
            <KV k="Volume" v={vol > 0 ? `${Math.round(vol)} kg` : "—"} />
            <KV k="Open threads" v={open.map((e) => e.body_part ?? e.kind).join(", ") || "none"} />
          </dl>
        </Panel>
      </div>
    </div>
  );
}

function RecoveryTab({ snapshot, extras }: { snapshot: AppSnapshot; extras: AnalyzeExtras }) {
  const hrv = extras.recoveryBase?.series["hrv_ms"] ?? [];
  const dates = extras.recoveryBase?.dates ?? [];
  const green = snapshot.derived.filter((d) => d.readiness_gate === "green").length;
  const amber = snapshot.derived.filter((d) => d.readiness_gate === "amber").length;
  const red = snapshot.derived.filter((d) => d.readiness_gate === "red").length;

  return (
    <div className="grid gap-px bg-neutral-200">
      <div className="grid gap-px @5xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Recovery by session type"
            hint="Mean HRV on day+1 minus the 60-day HRV mean, grouped by previous session type. Descriptive delta, not a prescription."
          />
          <RecoveryByType snapshot={snapshot} />
        </Panel>
        <Panel>
          <PanelHeader title="Recovery baselines" />
          {dates.length > 0 ? (
            <div className="p-2">
              <BaselineBandChart
                data={dates.map((date, i) => ({ date, value: hrv[i] ?? null }))}
                mean={computeBaseline(hrv)?.mean ?? null}
                sd={computeBaseline(hrv)?.sd ?? null}
                label="HRV"
                unit="ms"
                color="var(--chart-hrv)"
                decimals={0}
                todayZ={null}
              />
            </div>
          ) : (
            <EmptyNote>Need more daily HRV.</EmptyNote>
          )}
        </Panel>
      </div>
      <div className="grid gap-px @5xl:grid-cols-3">
        <Panel>
          <PanelHeader title="Sleep debt" />
          <div className="px-3 py-2">
            <Sparkline
              values={snapshot.derived.slice().reverse().map((d) => d.sleep_debt_7d_min)}
              width={640}
              height={100}
              fillArea
              stroke="#171717"
              className="w-full"
            />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Sleep → HRV" />
          {extras.sleepHrv ? (
            <div className="p-2">
              <ScatterRegression
                points={extras.sleepHrv.points}
                line={extras.sleepHrv.line}
                stats={extras.sleepHrv.stats}
                xLabel="Sleep (h)"
                yLabel="HRV (ms)"
              />
            </div>
          ) : (
            <EmptyNote>Not enough paired days.</EmptyNote>
          )}
        </Panel>
        <Panel>
          <PanelHeader title="Gate history" />
          <div className="px-3 py-3">
            <GateStrip days={expandGates(snapshot)} size="md" />
            <dl className="mt-3 grid grid-cols-2 gap-1 text-[12px]">
              <KV k="Green" v={`${green} d`} />
              <KV k="Amber" v={`${amber} d`} />
              <KV k="Red" v={`${red} d`} />
            </dl>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RecoveryByType({ snapshot }: { snapshot: AppSnapshot }) {
  const hrvByDate = new Map(snapshot.daily.map((d) => [d.date, d.hrv_ms] as const));
  const mean = computeBaseline(snapshot.daily.map((d) => d.hrv_ms))?.mean ?? null;
  const groups: Record<string, number[]> = { threshold: [], long: [], z2: [], ride: [], golf: [] };
  for (const w of snapshot.allWorkouts) {
    const next = hrvByDate.get(addDays(w.date, 1));
    if (next == null || mean == null) continue;
    const delta = next - mean;
    const z = snapshot.zonesByWorkoutId[w.id];
    const hard = (z?.hr_z4_s ?? 0) + (z?.hr_z5_s ?? 0);
    if (isRunType(w.type) && (hard >= 8 * 60 || (w.rpe ?? 0) >= 7)) groups.threshold.push(delta);
    else if (isLongRun(w)) groups.long.push(delta);
    else if (isRunType(w.type)) groups.z2.push(delta);
    else if (isRideType(w.type)) groups.ride.push(delta);
    else if (w.type.toLowerCase() === "golf") groups.golf.push(delta);
  }
  const rows = Object.entries(groups).map(([k, xs]) => ({
    label: k,
    value: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0,
  }));
  const mag = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div className="flex items-end gap-2 px-3 py-4">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-1 flex-col items-center">
          <div
            className={cn("w-full", r.value >= 0 ? "bg-blue-600" : "bg-neutral-900")}
            style={{ height: `${(Math.abs(r.value) / mag) * 80}px` }}
            title={`${r.label}: ${r.value.toFixed(1)} ms`}
          />
          <span className="mt-1 text-[9px] uppercase text-neutral-400">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function StatsTab({ extras }: { extras: AnalyzeExtras }) {
  const acwr = (extras.load?.series ?? []).map((s) => ({ date: s.date, value: s.acwr }));
  return (
    <div className="grid gap-px bg-neutral-200 @5xl:grid-cols-3">
      <Panel>
        <PanelHeader title="Correlation matrix" />
        <div className="p-2">
          {extras.matrix ? (
            <CorrelationHeatmap
              metrics={extras.matrix.metrics}
              matrix={extras.matrix.matrix}
              n={extras.matrix.n}
            />
          ) : (
            <EmptyNote>Need overlapping history.</EmptyNote>
          )}
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Acute : chronic" />
        <div className="p-2">
          <RatioBandChart data={acwr} band={[0.8, 1.3]} refLine={1} label="ACWR" />
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Distributions" />
        <div className="grid gap-3 p-2">
          {extras.dists.map((d, i) =>
            d ? (
              <div key={i}>
                <div className="mb-1 text-[11px] font-medium">{metricLabel(d.metric)}</div>
                <HistogramChart
                  bins={toHistBins(d.histogram)}
                  percentiles={{ p5: d.percentiles.p5, p50: d.percentiles.p50, p95: d.percentiles.p95 }}
                  latest={d.latest}
                  label={metricLabel(d.metric)}
                />
              </div>
            ) : null,
          )}
        </div>
      </Panel>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-neutral-400">{k}</dt>
      <dd className="font-mono text-[12px] tabular-nums">{v}</dd>
    </div>
  );
}

function latestNonNull(arr: ReadonlyArray<number | null> | undefined): number | null {
  if (!arr) return null;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]!;
  return null;
}

function maxHr(snapshot: AppSnapshot, pred: (w: AppSnapshot["workouts"][number]) => boolean): number | null {
  let max: number | null = null;
  for (const w of snapshot.allWorkouts) {
    if (!pred(w) || w.max_hr == null) continue;
    if (max == null || w.max_hr > max) max = w.max_hr;
  }
  return max;
}

function expandGates(snapshot: AppSnapshot): Array<{ date: string; gate: Gate | null }> {
  return snapshot.derived
    .slice(0, 90)
    .map((d) => ({ date: d.date, gate: d.readiness_gate }))
    .reverse();
}

function toHistBins(hist: { edges: number[]; counts: number[] } | null) {
  if (!hist) return [];
  const out: Array<{ binStart: number; binEnd: number; count: number }> = [];
  for (let k = 0; k < hist.counts.length; k++) {
    out.push({
      binStart: hist.edges[k]!,
      binEnd: hist.edges[k + 1] ?? hist.edges[k]!,
      count: hist.counts[k]!,
    });
  }
  return out;
}
