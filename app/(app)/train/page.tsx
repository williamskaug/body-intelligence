import Link from "next/link";
import { PageChrome } from "@/components/app/page-chrome";
import { AddWorkoutDialog } from "@/components/train/add-workout-dialog";
import { TrainCalendar, TrainList } from "@/components/train/train-view";
import { loadAppSnapshot, requireUser } from "@/lib/app/snapshot";
import { parseWindow, windowQuery } from "@/lib/app/window";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  days?: string;
  focus?: string;
  nogolf?: string;
  view?: string;
  workout?: string;
}>;

export default async function TrainPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!user) return null;
  const params = await searchParams;
  const window = parseWindow(params);
  const snapshot = await loadAppSnapshot(user.id, user.email, window);
  const view = params.view === "calendar" ? "calendar" : "list";
  const hours = snapshot.allWorkouts.reduce((a, w) => a + (w.duration_min ?? 0), 0) / 60;

  return (
    <PageChrome snapshot={snapshot} showStatus extra={<AddWorkoutDialog todayDate={snapshot.todayDate} />}>
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-3 py-1.5">
        <nav className="flex gap-3 text-[11px] font-medium uppercase tracking-wide">
          <Link
            href={`/train${windowQuery(window, { view: "list" })}`}
            className={cn(
              "border-b-2 pb-0.5",
              view === "list" ? "border-foreground" : "border-transparent text-neutral-400",
            )}
          >
            List
          </Link>
          <Link
            href={`/train${windowQuery(window, { view: "calendar" })}`}
            className={cn(
              "border-b-2 pb-0.5",
              view === "calendar" ? "border-foreground" : "border-transparent text-neutral-400",
            )}
          >
            Calendar
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-neutral-500">
            {hours.toFixed(0)} h · {snapshot.allWorkouts.length} sessions · {snapshot.days} d
          </span>
        </div>
      </div>
      {view === "calendar" ? (
        <TrainCalendar snapshot={snapshot} />
      ) : (
        <TrainList snapshot={snapshot} selectedId={params.workout ?? null} />
      )}
    </PageChrome>
  );
}
