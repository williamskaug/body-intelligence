import Link from "next/link";
import { EmptyNote, Panel, PanelHeader } from "@/components/app/panel";
import { SvgBars, SvgLine, SvgStackedWeekly } from "@/components/app/charts";
import { Sparkline } from "@/components/data/sparkline";
import { addDays } from "@/lib/app/dates";
import { formatClock, formatHours, formatKm, formatPace, num, paceFromWorkout } from "@/lib/app/format";
import type { AnalyzeExtras } from "@/lib/app/analyze-extras";
import type { AnalyzeTab } from "@/lib/app/analyze-tabs";
import type { AppSnapshot } from "@/lib/app/snapshot";
import {
  isLongRun,
  isRideType,
  isRunType,
  runningEfficiency,
  weeklyVolume,
  workoutTitle,
} from "@/lib/app/training";
import { weekStart } from "@/lib/data-display/aggregate";
import { KV, latestNonNull, maxHr } from "./analyze-helpers";

export { ANALYZE_TABS, parseAnalyzeTab } from "@/lib/app/analyze-tabs";
export type { AnalyzeTab } from "@/lib/app/analyze-tabs";
export type { AnalyzeExtras } from "@/lib/app/analyze-extras";


export async function AnalyzeView({
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
          <p className="min-w-0 flex-1 text-[12px] leading-snug text-pretty [overflow-wrap:break-word] line-clamp-2">
            {extras.insightLead}
          </p>
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
      <AnalyzePanel tab={tab} snapshot={snapshot} extras={extras} />
    </div>
  );
}


async function AnalyzePanel({
  tab,
  snapshot,
  extras,
}: {
  tab: AnalyzeTab;
  snapshot: AppSnapshot;
  extras: AnalyzeExtras;
}) {
  if (tab === "build") {
    const { BuildTab } = await import("./build-tab");
    return <BuildTab snapshot={snapshot} extras={extras} />;
  }
  if (tab === "fitness") return <FitnessTab snapshot={snapshot} extras={extras} />;
  if (tab === "long-run") return <LongRunTab snapshot={snapshot} />;
  if (tab === "intensity") return <IntensityTab snapshot={snapshot} />;
  if (tab === "form") {
    const { FormTab } = await import("./form-tab");
    return <FormTab snapshot={snapshot} />;
  }
  if (tab === "recovery") {
    const { RecoveryTab } = await import("./recovery-tab");
    return <RecoveryTab snapshot={snapshot} extras={extras} />;
  }
  const { StatsTab } = await import("./stats-tab");
  return <StatsTab extras={extras} />;
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
          <SvgLine
            points={vo2Dates.map((date, i) => ({ x: date, y: vo2[i] ?? null }))}
            height={140}
          />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Threshold anchor" href="/memory?path=THRESHOLDS.md" hrefLabel="THRESHOLDS.md" />
          <dl className="grid grid-cols-1 gap-3 px-3 py-3 text-[12px] @md:grid-cols-2">
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
        <table className="w-full text-left text-[12px]">
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

