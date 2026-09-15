import Link from "next/link";
import { AnalyzeView, ANALYZE_TABS, parseAnalyzeTab } from "@/components/analyze/analyze-view";
import { beginAnalyzeExtras, loadAnalyzeExtras } from "@/lib/app/analyze-extras";
import { isoWeek } from "@/lib/app/dates";
import { loadAppSnapshot, requireUser } from "@/lib/app/snapshot";
import { parseWindow, windowQuery } from "@/lib/app/window";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  days?: string;
  focus?: string;
  nogolf?: string;
  tab?: string;
}>;

export default async function AnalyzePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!user) return null;
  const params = await searchParams;
  const window = parseWindow(params);
  const tab = parseAnalyzeTab(params.tab);
  const extrasDays = Math.min(365, Math.max(window.days, 90));
  const [snapshot, heavy] = await Promise.all([
    loadAppSnapshot(user.id, user.email, window),
    beginAnalyzeExtras(user.id, extrasDays, window.focusRun),
  ]);
  const extras = await loadAnalyzeExtras(user.id, snapshot, heavy);
  const week = isoWeek(snapshot.todayDate);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3 py-1.5">
        <nav className="flex min-w-0 flex-wrap gap-3 text-[11px] font-medium uppercase tracking-wide">
          {ANALYZE_TABS.map((t) => (
            <Link
              key={t.id}
              href={`/analyze${windowQuery(window, { tab: t.id })}`}
              className={cn(
                "border-b-2 pb-0.5",
                tab === t.id ? "border-foreground" : "border-transparent text-neutral-400 hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <span className="shrink-0 font-mono text-[11px] text-neutral-500">{week.label}</span>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <AnalyzeView snapshot={snapshot} tab={tab} extras={extras} />
      </div>
    </div>
  );
}
