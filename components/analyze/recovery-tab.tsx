import { EmptyNote, Panel, PanelHeader } from "@/components/app/panel";
import { Sparkline } from "@/components/data/sparkline";
import { BaselineBandChart, ScatterRegression } from "@/components/analyze/lazy-charts";
import { GateStrip } from "@/components/data/gate-strip";
import { addDays } from "@/lib/app/dates";
import type { AnalyzeExtras } from "@/lib/app/analyze-extras";
import type { AppSnapshot } from "@/lib/app/snapshot";
import { isLongRun, isRideType, isRunType } from "@/lib/app/training";
import { computeBaseline } from "@/lib/data-display/baseline";
import { cn } from "@/lib/utils";
import { expandGates, KV } from "./analyze-helpers";

export function RecoveryTab({ snapshot, extras }: { snapshot: AppSnapshot; extras: AnalyzeExtras }) {
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
