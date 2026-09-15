import { PageChrome } from "@/components/app/page-chrome";
import { TodayView } from "@/components/today/today-view";
import { EmptyDataState } from "@/components/data/empty-state";
import { loadAppSnapshot, requireUser } from "@/lib/app/snapshot";
import { parseWindow } from "@/lib/app/window";
import { getLoadBalance } from "@/lib/mcp/tools/get-load-balance";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ days?: string; focus?: string; nogolf?: string }>;

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!user) return null;
  const window = parseWindow(await searchParams);
  const snapshot = await loadAppSnapshot(user.id, user.email, window);

  const hasData =
    snapshot.allWorkouts.length > 0 || snapshot.daily.length > 0 || snapshot.events.length > 0;

  let ctl: number | null = null;
  let tsb: number | null = null;
  let ctlRamp: number | null = null;
  try {
    const load = await getLoadBalance(user.id, { days: Math.max(window.days, 84) });
    ctl = load.current.ctl;
    tsb = load.current.tsb;
    ctlRamp = load.current.ctl_ramp_7d;
  } catch {
    // Load engine may fail if history is thin.
  }

  return (
    <PageChrome snapshot={snapshot} showStatus action={{ label: "Log check-in", href: "/body#check-in" }}>
      {hasData ? (
        <TodayView snapshot={snapshot} ctl={ctl} tsb={tsb} ctlRamp={ctlRamp} />
      ) : (
        <div className="p-8">
          <EmptyDataState email={user.email} />
        </div>
      )}
    </PageChrome>
  );
}
