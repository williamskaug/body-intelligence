import Link from "next/link";
import { EmptyNote, Panel, PanelHeader, TypeChip } from "@/components/app/panel";
import { SvgBars, SvgHBars } from "@/components/app/charts";
import { formatDurationMin, formatKm, num } from "@/lib/app/format";
import type { AppSnapshot, WorkoutMetricsRow, WorkoutZonesRow } from "@/lib/app/snapshot";
import { hoursBySport, weeklyVolume, workoutTitle } from "@/lib/app/training";
import { impulseForWorkout } from "@/lib/data-display/metric-series";
import { shortLabelForType } from "@/lib/data-display/workout-types";

export function TrainList({
  snapshot,
  selectedId,
}: {
  snapshot: AppSnapshot;
  selectedId: string | null;
}) {
  const weeks = weeklyVolume(
    snapshot.allWorkouts.map((w) => ({
      ...w,
      vendor_training_load: snapshot.metricsByWorkoutId[w.id]?.vendor_training_load,
    })),
    snapshot.todayDate,
    Math.max(8, Math.round(snapshot.days / 7)),
  );
  const byType = hoursBySport(snapshot.allWorkouts);
  const selected =
    snapshot.workouts.find((w) => w.id === selectedId) ?? snapshot.workouts[0] ?? null;
  const rpeFallback = weeks.reduce((a, w) => a + w.rpeFallback, 0);

  return (
    <div className="flex min-h-full flex-col">
      <div className="grid gap-px bg-neutral-200 lg:grid-cols-[1.4fr_0.8fr]">
        <Panel>
          <PanelHeader
            title="Weekly load"
            extra={rpeFallback > 0 ? `RPE fallback on ${rpeFallback} sessions` : undefined}
          />
          <div className="px-2 pt-2">
            <SvgBars
              values={weeks.map((w) => w.load)}
              labels={weeks.map((w) => w.label)}
              currentIndex={weeks.length - 1}
              height={96}
              ariaLabel="Weekly training load"
            />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Time by type" extra={`${snapshot.days} d`} />
          <SvgHBars
            rows={byType.slice(0, 6).map((r) => ({
              label: r.type,
              value: r.hours,
              max: byType[0]?.hours ?? 1,
            }))}
          />
        </Panel>
      </div>

      <div className="grid min-h-0 flex-1 gap-px bg-neutral-200 lg:grid-cols-[1.4fr_0.8fr]">
        <Panel className="flex min-h-0 flex-col">
          <div className="overflow-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-neutral-400">
                <tr className="border-b border-neutral-200">
                  {["Date", "Type", "Title", "Dur", "Km", "Avg HR", "Load", "Src"].map((h) => (
                    <th key={h} className="px-2 py-1.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshot.workouts.map((w) => {
                  const m = snapshot.metricsByWorkoutId[w.id];
                  const load = impulseForWorkout({
                    duration_min: w.duration_min,
                    rpe: w.rpe,
                    vendor_training_load: m?.vendor_training_load ?? null,
                  });
                  const active = selected?.id === w.id;
                  return (
                    <tr key={w.id} className={active ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}>
                      <td className="px-2 py-1 font-mono">
                        <Link href={trainHref(snapshot, w.id)} className="block">
                          {w.date}
                        </Link>
                      </td>
                      <td className="px-2 py-1">
                        <TypeChip>{shortLabelForType(w.type)}</TypeChip>
                      </td>
                      <td className="max-w-[14rem] truncate px-2 py-1">{workoutTitle(w)}</td>
                      <td className="px-2 py-1 font-mono">{formatDurationMin(w.duration_min)}</td>
                      <td className="px-2 py-1 font-mono">{formatKm(num(w.distance_km))}</td>
                      <td className="px-2 py-1 font-mono">{w.avg_hr ?? "—"}</td>
                      <td className="px-2 py-1 font-mono">{load > 0 ? Math.round(load) : "—"}</td>
                      <td className="px-2 py-1 text-neutral-400">{w.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {snapshot.workouts.length === 0 ? <EmptyNote>No workouts in this window.</EmptyNote> : null}
          </div>
        </Panel>
        <WorkoutDetail
          workout={selected}
          metrics={selected ? snapshot.metricsByWorkoutId[selected.id] : undefined}
          zones={selected ? snapshot.zonesByWorkoutId[selected.id] : undefined}
        />
      </div>
    </div>
  );
}

function trainHref(snapshot: AppSnapshot, id: string): string {
  const p = new URLSearchParams();
  p.set("days", String(snapshot.days));
  if (snapshot.focusRun) p.set("focus", "run");
  p.set("view", "list");
  p.set("workout", id);
  return `/train?${p.toString()}`;
}

function WorkoutDetail({
  workout,
  metrics,
  zones,
}: {
  workout: AppSnapshot["workouts"][number] | null;
  metrics?: WorkoutMetricsRow;
  zones?: WorkoutZonesRow;
}) {
  if (!workout) {
    return (
      <Panel>
        <EmptyNote>Select a workout.</EmptyNote>
      </Panel>
    );
  }
  const load = impulseForWorkout({
    duration_min: workout.duration_min,
    rpe: workout.rpe,
    vendor_training_load: metrics?.vendor_training_load ?? null,
  });
  const z: Array<[string, number]> = zones
    ? (
        [
          ["Z1", zones.hr_z1_s],
          ["Z2", zones.hr_z2_s],
          ["Z3", zones.hr_z3_s],
          ["Z4", zones.hr_z4_s],
          ["Z5", zones.hr_z5_s],
        ] as const
      )
        .map(([label, sec]) => [label, Number(sec ?? 0)] as [string, number])
        .filter(([, sec]) => sec > 0)
    : [];
  const zTot = z.reduce((a, [, s]) => a + s, 0);
  return (
    <Panel>
      <PanelHeader title={workoutTitle(workout)} extra={workout.date} />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2 text-[12px]">
        <KV k="Duration" v={workout.duration_min != null ? `${workout.duration_min} min` : "—"} />
        <KV k="Distance" v={formatKm(num(workout.distance_km), 1)} extra="km" />
        <KV k="Avg HR" v={workout.avg_hr != null ? String(workout.avg_hr) : "—"} />
        <KV k="Max HR" v={workout.max_hr != null ? String(workout.max_hr) : "—"} />
        <KV k="Load" v={load > 0 ? String(Math.round(load)) : "—"} />
        <KV k="RPE" v={workout.rpe != null ? String(workout.rpe) : "—"} />
      </dl>
      {zTot > 0 ? (
        <div className="px-3 pb-3">
          <div className="bi-label mb-1">Time in HR zone</div>
          <div className="flex h-2 overflow-hidden">
            {z.map(([label, sec], i) =>
              sec && sec > 0 ? (
                <div
                  key={label}
                  title={`${label} ${fmtZone(sec)}`}
                  style={{
                    width: `${(sec / zTot) * 100}%`,
                    backgroundColor: ["#d4d4d4", "#93c5fd", "#4ade80", "#fbbf24", "#f87171"][i],
                  }}
                />
              ) : null,
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 font-mono text-[10px] text-neutral-500">
            {z.map(([label, sec]) =>
              sec ? (
                <span key={label}>
                  {label} {fmtZone(sec)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      ) : null}
      <div className="border-t border-neutral-100 px-3 py-2">
        <div className="bi-label mb-1">Notes</div>
        <p className="min-h-16 text-[12px] text-neutral-600">{workout.notes ?? ""}</p>
      </div>
    </Panel>
  );
}

function KV({ k, v, extra }: { k: string; v: string; extra?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-neutral-400">{k}</dt>
      <dd className="font-mono tabular-nums">
        {v}
        {extra && v !== "—" ? ` ${extra}` : ""}
      </dd>
    </div>
  );
}

function fmtZone(sec: number): string {
  const m = Math.round(sec / 60);
  return `${m}'`;
}

export function TrainCalendar({ snapshot }: { snapshot: AppSnapshot }) {
  const weeks = weeklyVolume(
    snapshot.allWorkouts.map((w) => ({
      ...w,
      vendor_training_load: snapshot.metricsByWorkoutId[w.id]?.vendor_training_load,
    })),
    snapshot.todayDate,
    Math.max(8, Math.round(snapshot.days / 7)),
  );
  const byType = hoursBySport(snapshot.allWorkouts);
  const [y, m] = snapshot.todayDate.split("-").map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const startDow = (first.getUTCDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date, day: d });
  }
  const byDate = new Map<string, AppSnapshot["workouts"]>();
  for (const w of snapshot.allWorkouts) {
    const arr = byDate.get(w.date) ?? [];
    arr.push(w);
    byDate.set(w.date, arr);
  }

  return (
    <div className="flex flex-col">
      <div className="grid gap-px bg-neutral-200 lg:grid-cols-[1.4fr_0.8fr]">
        <Panel>
          <PanelHeader title="Weekly load" />
          <div className="px-2 pt-2">
            <SvgBars
              values={weeks.map((w) => w.load)}
              labels={weeks.map((w) => w.label)}
              currentIndex={weeks.length - 1}
              height={96}
            />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Time by type" />
          <SvgHBars
            rows={byType.slice(0, 6).map((r) => ({
              label: r.type,
              value: r.hours,
              max: byType[0]?.hours ?? 1,
            }))}
          />
        </Panel>
      </div>
      <Panel>
        <div className="grid grid-cols-7 border-b border-neutral-200 text-center text-[10px] uppercase tracking-wide text-neutral-400">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="border-r border-neutral-100 py-1 last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            const ws = c.date ? byDate.get(c.date) ?? [] : [];
            const gate = c.date ? snapshot.derivedGateByDate[c.date] : null;
            return (
              <div
                key={i}
                className="min-h-[4.5rem] border-b border-r border-neutral-100 p-1.5 last:border-r-0"
              >
                {c.day ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px]">{c.day}</span>
                      {gate ? (
                        <span
                          className={
                            gate === "green"
                              ? "size-1.5 bg-emerald-500"
                              : gate === "amber"
                                ? "size-1.5 bg-amber-500"
                                : "size-1.5 bg-rose-500"
                          }
                        />
                      ) : null}
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {ws.map((w) => (
                        <li key={w.id} className="flex items-center gap-1 text-[10px]">
                          <span className="size-1.5 bg-neutral-900" />
                          <span className="truncate">
                            {shortLabelForType(w.type).toLowerCase()} {formatDurationMin(w.duration_min)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
