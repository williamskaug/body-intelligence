import { Panel, PanelHeader } from "@/components/app/panel";
import { SvgBars, SvgHBars, SvgStackedWeekly } from "@/components/app/charts";
import { PerformanceManagementChart } from "@/components/analyze/lazy-charts";
import { formatHours, formatKm } from "@/lib/app/format";
import type { AnalyzeExtras } from "@/lib/app/analyze-extras";
import type { AppSnapshot } from "@/lib/app/snapshot";
import { hoursBySport, weeklyRampPct, weeklyVolume } from "@/lib/app/training";
import { weekStart } from "@/lib/data-display/aggregate";

export function BuildTab({ snapshot, extras }: { snapshot: AppSnapshot; extras: AnalyzeExtras }) {
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
      <div className="grid gap-px @5xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="grid gap-px @3xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Ramp compliance" hint="Week-over-week change in run km." />
          <div className="flex items-end gap-1 px-3 pt-3 pb-2">
            {ramps.map((r, i) => (
              <div key={weeks[i]!.weekStart} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="max-w-full truncate font-mono text-[9px] text-neutral-500">
                  {r == null ? "—" : `${r >= 0 ? "+" : ""}${Math.round(r)}%`}
                </span>
                <div
                  className="w-full bg-neutral-800"
                  style={{ height: `${r == null ? 4 : Math.min(96, Math.max(6, Math.abs(r)))}px` }}
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
        </div>
        <Panel>
          <PanelHeader
            title="Load balance"
            hint="CTL / ATL / TSB and 7-day fitness ramp are load statistics, not a verdict. Shaded: high-fatigue (below) / fresh (above)."
          />
          <div className="min-w-0 p-2">
            <PerformanceManagementChart data={pmc} ramp={extras.load?.current.ctl_ramp_7d ?? null} minDays={10} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
