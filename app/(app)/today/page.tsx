import { TodayView } from "@/components/today/today-view";
import { EmptyDataState } from "@/components/data/empty-state";
import { loadAppSnapshot, requireUser } from "@/lib/app/snapshot";
import { parseWindow } from "@/lib/app/window";
import { cachedLoadBalance } from "@/lib/app/analyze-extras";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ days?: string; focus?: string; nogolf?: string }>;

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!user) return null;
  const window = parseWindow(await searchParams);
  const [snapshot, load] = await Promise.all([
    loadAppSnapshot(user.id, user.email, window),
    cachedLoadBalance(user.id, Math.max(window.days, 84)).catch(() => null),
  ]);

  const hasData =
    snapshot.allWorkouts.length > 0 || snapshot.daily.length > 0 || snapshot.events.length > 0;

  return (
    <div className="h-full min-h-0 overflow-auto">
      {hasData ? (
        <TodayView
          snapshot={snapshot}
          ctl={load?.current.ctl ?? null}
          tsb={load?.current.tsb ?? null}
          ctlRamp={load?.current.ctl_ramp_7d ?? null}
        />
      ) : (
        <div className="p-8">
          <EmptyDataState email={user.email} />
        </div>
      )}
    </div>
  );
}
