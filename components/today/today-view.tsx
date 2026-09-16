import { Sparkline } from "@/components/data/sparkline";
import { Markdown } from "@/components/data/markdown";
import { EmptyNote, Kpi, Panel, PanelHeader, TypeChip } from "@/components/app/panel";
import { SvgLine } from "@/components/app/charts";
import { addDays, isoWeek, weekdayShort } from "@/lib/app/dates";
import { formatClock, formatClockDelta, formatHours, formatKm, formatPace, formatZScore, num, paceFromWorkout } from "@/lib/app/format";
import { parseWeekPlan, planExcerpt, clipAtWord } from "@/lib/app/parse-week";
import type { AppSnapshot, RaceInfo } from "@/lib/app/snapshot";
import {
  isRunType,
  runningEfficiency,
  thisWeekWorkouts,
  weeklyVolume,
  workoutTitle,
} from "@/lib/app/training";
import { formatZ, GATE_LABEL } from "@/lib/data-display/derived";
import { shortLabelForType } from "@/lib/data-display/workout-types";
import { computeBaseline } from "@/lib/data-display/baseline";

export function TodayView({
  snapshot,
  ctl,
  tsb,
  ctlRamp,
}: {
  snapshot: AppSnapshot;
  ctl: number | null;
  tsb: number | null;
  ctlRamp: number | null;
}) {
  const { todayDate, race, allWorkouts, daily, derived, events, capacity, contentByPath, metricsByWorkoutId } =
    snapshot;
  const weeks = weeklyVolume(allWorkouts, todayDate, 16);
  const thisW = weeks[weeks.length - 1];
  const prevW = weeks[weeks.length - 2];
  const weekWorkouts = thisWeekWorkouts(allWorkouts, todayDate);

  const runEfs = allWorkouts
    .filter((w) => isRunType(w.type))
    .map((w) => ({
      date: w.date,
      ef: runningEfficiency(num(w.distance_km), w.duration_min, w.avg_hr),
    }))
    .filter((x): x is { date: string; ef: number } => x.ef != null);
  const latestEf = runEfs[0]?.ef ?? null;
  const ef90ago = runEfs.find((e) => e.date <= addDays(todayDate, -80))?.ef ?? null;
  const efDelta =
    latestEf != null && ef90ago != null && ef90ago > 0 ? ((latestEf - ef90ago) / ef90ago) * 100 : null;

  const longRuns = allWorkouts.filter(
    (w) => isRunType(w.type) && ((num(w.distance_km) ?? 0) >= 16 || (w.duration_min ?? 0) >= 75),
  );
  const lastLongDecouple = longRuns
    .map((w) => num(metricsByWorkoutId[w.id]?.decoupling_pct))
    .find((v) => v != null);

  const marathonSeries = capacity.map((c) => ({
    x: isoWeek(c.date).label,
    y: c.race_pred_marathon_s != null ? Number(c.race_pred_marathon_s) : null,
  }));
  const latestMarathon = [...capacity].reverse().find((c) => c.race_pred_marathon_s != null);
  const predSec = latestMarathon?.race_pred_marathon_s != null ? Number(latestMarathon.race_pred_marathon_s) : null;
  const vo2 = [...capacity].reverse().find((c) => c.vo2max_running != null)?.vo2max_running;
  const vo2n = vo2 != null ? Number(vo2) : null;
  const vo2Prev = capacity.find((c) => c.vo2max_running != null)?.vo2max_running;
  const vo2Delta =
    vo2n != null && vo2Prev != null ? vo2n - Number(vo2Prev) : null;

  const todayDaily = daily.find((d) => d.date === todayDate) ?? daily[0];
  const lastNight = todayDaily;
  const derivedToday = derived.find((d) => d.date === todayDate) ?? derived[0];

  const openEvents = events.filter((e) => !e.resolved_date);
  const plan = parseWeekPlan(contentByPath.get("CURRENT.md") ?? "");
  const todayWorkout = allWorkouts.find((w) => w.date === todayDate);
  const briefing = snapshot.latestBriefingPath
    ? contentByPath.get(snapshot.latestBriefingPath)
    : null;
  const insight = snapshot.latestInsightPath
    ? contentByPath.get(snapshot.latestInsightPath)
    : null;

  const weekKmCap = 60;
  const weekHCap = 10;
  const goalLabel = race ? shortGoal(race) : null;

  return (
    <div className="flex flex-col gap-px p-px">
      <div className="grid min-w-0 grid-cols-2 gap-px bg-neutral-200 @xl:grid-cols-4 @5xl:grid-cols-8">
        <Kpi
          label="Pred. marathon"
          value={formatClock(predSec)}
          sub={
            predSec != null && race?.goalSeconds != null
              ? `gap ${formatClockDelta(predSec - race.goalSeconds)}`
              : race?.goal
                ? `goal ${race.goal}`
                : undefined
          }
          href="/analyze?tab=fitness"
        />
        <Kpi
          label="Days to race"
          value={race ? Math.max(0, race.daysOut) : "[N]"}
          sub={plan.blockLabel ?? race?.name ?? undefined}
          href="/memory?path=CURRENT.md"
        />
        <Kpi
          label="Run km · wk"
          value={formatKm(thisW?.runKm ?? 0, 0)}
          sub={
            prevW
              ? `${pctDelta(thisW?.runKm ?? 0, prevW.runKm)} · cap ${weekKmCap}`
              : `cap ${weekKmCap}`
          }
          href="/analyze?tab=build"
        />
        <Kpi
          label="Aerobic h · wk"
          value={formatHours(thisW?.aerobicHours ?? 0)}
          sub={`run ${(thisW?.runHours ?? 0).toFixed(1)} · ride ${(thisW?.rideHours ?? 0).toFixed(1)}`}
          href="/analyze?tab=build"
        />
        <Kpi
          label="Efficiency"
          value={latestEf != null ? latestEf.toFixed(2) : "—"}
          sub={efDelta != null ? `${efDelta >= 0 ? "+" : ""}${efDelta.toFixed(1)}% · 90 d` : "m/beat"}
          href="/analyze?tab=fitness"
        />
        <Kpi
          label="HRV"
          value={lastNight?.hrv_ms != null ? `${lastNight.hrv_ms} ms` : "—"}
          sub={formatZ(derivedToday?.hrv_z) ?? snapshot.baselines.hrv?.mean.toFixed(0)}
          href="/body"
        />
        <Kpi
          label="Sleep debt"
          value={
            derivedToday?.sleep_debt_7d_min != null
              ? `${Math.round(derivedToday.sleep_debt_7d_min)}m`
              : "—"
          }
          sub="7 d"
          href="/analyze?tab=recovery"
        />
        <Kpi
          label="Tissue"
          value={`${openEvents.length} open`}
          sub={
            openEvents[0]
              ? `${openEvents[0].body_part ?? openEvents[0].kind} · sev ${openEvents[0].severity ?? "—"}`
              : "none"
          }
          href="/health"
        />
      </div>

      <div className="grid min-w-0 gap-px bg-neutral-200 @5xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <Panel>
          <PanelHeader
            title="Race trajectory"
            hint="Vendor marathon prediction vs A-race goal. Descriptive — not a taper plan."
            href="/memory?path=GOALS.md"
            hrefLabel="GOALS.md"
          />
          <div className="flex min-w-0 items-start justify-between gap-3 px-3 pt-2 text-[11px]">
            <div className="min-w-0 text-pretty text-neutral-600">
              {race ? (
                <>
                  <div>
                    {race.name}
                    {race.tier ? ` · ${race.tier}-race` : ""} · {race.daysOut}d
                  </div>
                  <div className="mt-0.5 text-neutral-500">
                    {goalLabel ? `goal ${goalLabel}` : null}
                    {predSec != null && race.goalSeconds != null ? (
                      <span className={predSec <= race.goalSeconds ? " text-emerald-700" : " text-rose-600"}>
                        {goalLabel ? " · " : ""}
                        gap {formatClockDelta(predSec - race.goalSeconds)}
                      </span>
                    ) : null}
                  </div>
                </>
              ) : (
                "No A-race in GOALS.md"
              )}
            </div>
            {plan.blockLabel ? (
              <a
                href="/memory?path=CURRENT.md"
                className="shrink-0 text-right"
                title="Open CURRENT.md"
              >
                <div className="text-[10px] uppercase tracking-wide text-neutral-400">Block</div>
                <div className="max-w-[11rem] font-medium text-pretty text-neutral-700">{plan.blockLabel}</div>
              </a>
            ) : null}
          </div>
          <SvgLine
            points={marathonSeries.length ? marathonSeries : weeks.map((w) => ({ x: w.label, y: null }))}
            height={168}
            yFormat={(v) => formatClock(v)}
            refs={
              race?.goalSeconds != null
                ? [{ y: race.goalSeconds, color: "#e11d48", dash: true }]
                : []
            }
          />
        </Panel>

        <Panel>
          <PanelHeader
            title="Session"
            hint="Today's planned work from CURRENT.md plus what has been logged."
            href="/memory?path=CURRENT.md"
            hrefLabel="CURRENT.md"
            extra={
              derivedToday?.readiness_gate ? (
                <span className="font-semibold text-emerald-700">
                  GATE {GATE_LABEL[derivedToday.readiness_gate]}
                </span>
              ) : null
            }
          />
          <div className="px-3 py-2">
            {todayWorkout ? (
              <div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <TypeChip>{shortLabelForType(todayWorkout.type)}</TypeChip>
                  <span className="min-w-0 text-sm font-semibold">{workoutTitle(todayWorkout)}</span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-neutral-500">
                  HR {todayWorkout.avg_hr ?? "—"}
                  {todayWorkout.max_hr ? `–${todayWorkout.max_hr}` : ""}
                  {paceFromWorkout(num(todayWorkout.distance_km), todayWorkout.duration_min) != null
                    ? ` · ${formatPace(paceFromWorkout(num(todayWorkout.distance_km), todayWorkout.duration_min))}`
                    : ""}
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">Nothing logged today yet.</p>
            )}
            <div className="mt-3 border-t border-neutral-100 pt-2">
              <div className="mb-1 flex items-baseline justify-between text-[10px] uppercase tracking-wide text-neutral-400">
                <span>Week {isoWeek(todayDate).week}</span>
                <span>
                  {formatKm(thisW?.runKm ?? 0, 0)} / {weekKmCap} km ·{" "}
                  {formatHours(thisW?.aerobicHours ?? 0)} / {weekHCap} h
                </span>
              </div>
              <WeekPlan
                items={plan.items}
                workouts={weekWorkouts}
                todayDate={todayDate}
                raw={plan.raw}
              />
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Aerobic fitness" href="/analyze?tab=fitness" hrefLabel="Fitness →" />
          <div className="grid grid-cols-1 divide-y divide-neutral-100">
            <FitRow
              label="Efficiency factor"
              value={latestEf != null ? `${latestEf.toFixed(2)} m/beat` : "—"}
              series={runEfs
                .slice()
                .reverse()
                .slice(-24)
                .map((e) => e.ef)}
            />
            <FitRow
              label="Long-run decoupling"
              value={lastLongDecouple != null ? `${lastLongDecouple.toFixed(1)} %` : "—"}
              series={longRuns
                .slice()
                .reverse()
                .slice(-12)
                .map((w) => num(metricsByWorkoutId[w.id]?.decoupling_pct))}
            />
            <FitRow
              label="VO₂max run"
              value={vo2n != null ? vo2n.toFixed(1) : "—"}
              series={capacity.map((c) => (c.vo2max_running != null ? Number(c.vo2max_running) : null))}
              sub={vo2Delta != null ? `${vo2Delta >= 0 ? "+" : ""}${vo2Delta.toFixed(1)} · 90 d` : undefined}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px]">
              <span className="uppercase tracking-wide text-neutral-400">CTL</span>
              <span className="font-mono">
                {ctl != null ? Math.round(ctl) : "—"}
                {ctlRamp != null ? ` ${ctlRamp >= 0 ? "+" : "−"}${Math.abs(Math.round(ctlRamp))}/wk` : ""}
              </span>
              <span className="uppercase tracking-wide text-neutral-400">TSB</span>
              <span className="font-mono">{tsb != null ? `${tsb >= 0 ? "+" : ""}${Math.round(tsb)}` : "—"}</span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-px bg-neutral-200 @5xl:grid-cols-3">
        <Panel>
          <PanelHeader title="Last night" />
          {lastNight ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2 text-[12px]">
              <Row k="Sleep" v={`${num(lastNight.sleep_h)?.toFixed(1) ?? "—"}h`} />
              <Row
                k="Debt 7d"
                v={
                  derivedToday?.sleep_debt_7d_min != null
                    ? `${Math.round(derivedToday.sleep_debt_7d_min)} min`
                    : "—"
                }
              />
              <Row
                k="HRV"
                v={`${lastNight.hrv_ms ?? "—"} ms`}
                extra={formatZScore(derivedToday?.hrv_z)}
              />
              <Row
                k="RHR"
                v={`${lastNight.rhr_bpm ?? "—"}`}
                extra={formatZScore(derivedToday?.rhr_z)}
              />
            </dl>
          ) : (
            <EmptyNote>No daily entry yet.</EmptyNote>
          )}
        </Panel>
        <Panel>
          <PanelHeader title="Tissue & form" extra={`${openEvents.length} open`} href="/health" hrefLabel="Open" />
          {openEvents[0] ? (
            <div className="px-3 py-2 text-[12px]">
              <div className="flex items-center gap-2">
                <span className="font-medium uppercase text-amber-700">Open · sev {openEvents[0].severity ?? "—"}</span>
                <span>
                  {openEvents[0].body_part ?? openEvents[0].kind} — {openEvents[0].kind}
                </span>
              </div>
              {openEvents[0].next_milestone ? (
                <p className="mt-1 text-neutral-500">
                  Milestone {openEvents[0].next_milestone}
                  {openEvents[0].next_milestone_date ? ` · ${openEvents[0].next_milestone_date}` : ""}
                </p>
              ) : null}
              <p className="mt-1 line-clamp-3 text-neutral-600">
                {openEvents[0].updates.at(-1)?.note ?? openEvents[0].notes}
              </p>
            </div>
          ) : (
            <EmptyNote>No open health events.</EmptyNote>
          )}
        </Panel>
        <Panel>
          <PanelHeader
            title="Briefing"
            extra={snapshot.latestBriefingPath?.replace("briefings/", "").replace(".md", "")}
            href={
              snapshot.latestBriefingPath
                ? `/memory?path=${encodeURIComponent(snapshot.latestBriefingPath)}`
                : undefined
            }
            hrefLabel="dawn-agent"
          />
          <div className="max-h-40 overflow-y-auto px-3 py-2 text-[12px] leading-relaxed text-pretty text-neutral-700">
            {briefing ? (
              <Markdown>{briefing}</Markdown>
            ) : insight ? (
              <p>{insightLead(insight)}</p>
            ) : (
              <p className="text-neutral-400">No briefing yet — the dawn agent writes one each morning.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function FitRow({
  label,
  value,
  series,
  sub,
}: {
  label: string;
  value: string;
  series: Array<number | null>;
  sub?: string;
}) {
  const base = computeBaseline(series);
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</div>
        <div className="font-mono text-sm tabular-nums">{value}</div>
        {sub ? <div className="text-[10px] text-neutral-400">{sub}</div> : null}
      </div>
      <Sparkline
        values={series}
        baseline={base}
        width={120}
        height={36}
        stroke="#171717"
        className="w-[7.5rem] shrink-0"
      />
    </div>
  );
}

function Row({ k, v, extra }: { k: string; v: string; extra?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[10px] uppercase tracking-wide text-neutral-400">{k}</dt>
      <dd className="font-mono tabular-nums">
        {v}
        {extra ? <span className="ml-1 text-[10px] text-neutral-400">{extra}</span> : null}
      </dd>
    </div>
  );
}

function WeekPlan({
  items,
  workouts,
  todayDate,
  raw,
}: {
  items: ReturnType<typeof parseWeekPlan>["items"];
  workouts: AppSnapshot["allWorkouts"];
  todayDate: string;
  raw: string;
}) {
  if (items.length === 0) {
    const excerpt = planExcerpt(raw);
    return excerpt ? (
      <p className="text-[11px] leading-relaxed text-pretty text-neutral-600">
        {excerpt}{" "}
        <a href="/memory?path=CURRENT.md" className="uppercase tracking-wide text-neutral-400 hover:text-foreground">
          CURRENT.md
        </a>
      </p>
    ) : (
      <p className="text-[11px] text-neutral-400">No week plan in CURRENT.md.</p>
    );
  }
  const byDow = new Map(workouts.map((w) => [weekdayShort(w.date), w] as const));
  return (
    <ul className="text-[11px]">
      {items.map((item) => {
        const logged = byDow.get(item.dow);
        const isToday = weekdayShort(todayDate) === item.dow;
        return (
          <li
            key={item.dow}
            className={`flex items-center gap-2 border-t border-neutral-100 py-0.5 ${isToday ? "bg-neutral-50" : ""}`}
          >
            <span className="w-8 text-neutral-400">{item.dow}</span>
            {item.type ? <TypeChip>{item.type}</TypeChip> : null}
            <span className="min-w-0 flex-1 text-pretty [overflow-wrap:break-word]">
              {clipAtWord(item.title, 64)}
            </span>
            {logged || item.done ? (
              <span className="text-[10px] uppercase text-emerald-700">{isToday ? "today" : "done"}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function pctDelta(curr: number, prev: number): string {
  if (prev <= 0) return "—";
  const p = ((curr - prev) / prev) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(0)} %`;
}

function shortGoal(race: RaceInfo): string | null {
  if (race.goalSeconds != null) return formatClock(race.goalSeconds);
  if (!race.goal) return null;
  const first = race.goal.split(/[,(]/)[0]!.trim();
  return first.length > 28 ? `${first.slice(0, 27).trimEnd()}…` : first;
}

function insightLead(content: string): string {
  const stripped = content
    .replace(/^\s*#\s+.*(?:\n|$)/, "")
    .replace(/[#*_>`]/g, "")
    .replace(/\s*\n\s*/g, " ")
    .trim();
  return stripped.length > 280 ? `${stripped.slice(0, 277).trimEnd()}…` : stripped;
}
