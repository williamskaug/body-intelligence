import { Suspense } from "react";
import { AppHeader, type HeaderAction } from "@/components/app/app-header";
import { StatusStrip, consecutiveGreenDays } from "@/components/app/status-strip";
import { isRunType, workoutTitle } from "@/lib/app/training";
import type { AppSnapshot } from "@/lib/app/snapshot";

export function PageChrome({
  snapshot,
  action,
  extra,
  showStatus = false,
  children,
}: {
  snapshot: Pick<
    AppSnapshot,
    | "todayDate"
    | "derived"
    | "daily"
    | "workouts"
    | "allWorkouts"
    | "gateHistory"
    | "latestBriefingPath"
  >;
  action?: HeaderAction | null;
  extra?: React.ReactNode;
  showStatus?: boolean;
  children: React.ReactNode;
}) {
  const todayDaily = snapshot.daily.find((d) => d.date === snapshot.todayDate) ?? snapshot.daily[0];
  const todayWorkout =
    snapshot.allWorkouts.find((w) => w.date === snapshot.todayDate) ??
    snapshot.workouts.find((w) => w.date === snapshot.todayDate) ??
    null;
  const derived = snapshot.derived.find((d) => d.date === snapshot.todayDate) ?? snapshot.derived[0] ?? null;

  return (
    <>
      <Suspense fallback={<div className="h-11 border-b border-neutral-200 bg-white" />}>
        <AppHeader todayDate={snapshot.todayDate} action={action} extra={extra} />
      </Suspense>
      {showStatus ? (
        <StatusStrip
          derived={derived}
          todayDate={snapshot.todayDate}
          hrvMs={todayDaily?.hrv_ms ?? null}
          rhrBpm={todayDaily?.rhr_bpm ?? null}
          consecutiveGreen={consecutiveGreenDays(snapshot.gateHistory)}
          todayWorkout={
            todayWorkout
              ? {
                  type: isRunType(todayWorkout.type) ? "run" : todayWorkout.type,
                  title: workoutTitle(todayWorkout),
                }
              : null
          }
          briefingPath={snapshot.latestBriefingPath}
          gateHistory={snapshot.gateHistory}
        />
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto bg-neutral-50">{children}</div>
    </>
  );
}
