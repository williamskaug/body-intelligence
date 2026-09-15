import { Suspense } from "react";
import { AppHeader, type HeaderAction } from "@/components/app/app-header";
import { StatusStrip, consecutiveGreenDays } from "@/components/app/status-strip";
import { isRunType, workoutTitle } from "@/lib/app/training";
import type { AppSnapshot } from "@/lib/app/snapshot";

export type ChromeSnapshot = Pick<
  AppSnapshot,
  | "todayDate"
  | "derived"
  | "daily"
  | "workouts"
  | "allWorkouts"
  | "gateHistory"
  | "latestBriefingPath"
>;

export function PageChrome({
  snapshot,
  todayDate,
  action,
  extra,
  showStatus = false,
  children,
}: {
  snapshot?: ChromeSnapshot;
  todayDate?: string;
  action?: HeaderAction | null;
  extra?: React.ReactNode;
  showStatus?: boolean;
  children: React.ReactNode;
}) {
  const date = snapshot?.todayDate ?? todayDate;
  if (!date) throw new Error("PageChrome needs todayDate or snapshot.todayDate");

  const todayDaily = snapshot?.daily.find((d) => d.date === date) ?? snapshot?.daily[0];
  const todayWorkout =
    snapshot?.allWorkouts.find((w) => w.date === date) ??
    snapshot?.workouts.find((w) => w.date === date) ??
    null;
  const derived = snapshot?.derived.find((d) => d.date === date) ?? snapshot?.derived[0] ?? null;

  return (
    <>
      <Suspense fallback={<div className="h-11 shrink-0 border-b border-neutral-200 bg-white" />}>
        <AppHeader todayDate={date} action={action} extra={extra} />
      </Suspense>
      {showStatus && snapshot ? (
        <StatusStrip
          derived={derived}
          todayDate={date}
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
      <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-neutral-50">{children}</div>
    </>
  );
}
