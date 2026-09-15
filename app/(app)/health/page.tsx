import { PageChrome } from "@/components/app/page-chrome";
import { HealthView } from "@/components/health/health-view";
import { LogEventDialog } from "@/components/health/log-event-dialog";
import { loadAppSnapshot, requireUser } from "@/lib/app/snapshot";
import { parseWindow } from "@/lib/app/window";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  days?: string;
  focus?: string;
  nogolf?: string;
  event?: string;
}>;

export default async function HealthPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!user) return null;
  const params = await searchParams;
  const window = parseWindow(params);
  const snapshot = await loadAppSnapshot(user.id, user.email, window);
  const healthLog = snapshot.contentByPath.get("HEALTH_LOG.md") ?? null;

  return (
    <PageChrome snapshot={snapshot} extra={<LogEventDialog todayDate={snapshot.todayDate} />}>
      <HealthView
        events={snapshot.events}
        todayDate={snapshot.todayDate}
        selectedId={params.event ?? null}
        healthLog={healthLog}
      />
    </PageChrome>
  );
}
