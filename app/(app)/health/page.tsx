import { HealthView } from "@/components/health/health-view";
import { loadHealthPageData } from "@/lib/app/page-data";
import { requireUser } from "@/lib/app/snapshot";

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
  const { events, todayDate, healthLog } = await loadHealthPageData(user.id);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <HealthView
        events={events}
        todayDate={todayDate}
        selectedId={params.event ?? null}
        healthLog={healthLog}
      />
    </div>
  );
}
