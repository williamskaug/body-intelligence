import { TodayView } from "@/components/today/today-view";
import { EmptyDataState } from "@/components/data/empty-state";
import { loadTodayPageData } from "@/lib/app/page-data";
import { requireUser } from "@/lib/app/snapshot";
import { parseWindow } from "@/lib/app/window";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ days?: string; focus?: string; nogolf?: string }>;

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!user) return null;
  const window = parseWindow(await searchParams);
  const { snapshot, ctl, tsb, ctlRamp } = await loadTodayPageData(user.id, user.email, window);

  const hasData =
    snapshot.allWorkouts.length > 0 || snapshot.daily.length > 0 || snapshot.events.length > 0;

  return (
    <div className="h-full min-h-0 overflow-auto">
      {hasData ? (
        <TodayView snapshot={snapshot} ctl={ctl} tsb={tsb} ctlRamp={ctlRamp} />
      ) : (
        <div className="p-8">
          <EmptyDataState email={user.email} />
        </div>
      )}
    </div>
  );
}
