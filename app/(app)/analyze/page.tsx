import Link from "next/link";
import { AnalyzeView, ANALYZE_TABS, parseAnalyzeTab } from "@/components/analyze/analyze-view";
import { PageChrome } from "@/components/app/page-chrome";
import { loadAnalyzeExtras } from "@/lib/app/analyze-extras";
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
  const snapshot = await loadAppSnapshot(user.id, user.email, window);
  const tab = parseAnalyzeTab(params.tab);
  const extras = await loadAnalyzeExtras(user.id, snapshot);
  const week = isoWeek(snapshot.todayDate);

  return (
    <PageChrome
      snapshot={snapshot}
      showStatus
      action={
        extras.insightPath
          ? { label: "Read this week's insight", href: `/memory?path=${encodeURIComponent(extras.insightPath)}` }
          : null
      }
    >
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-3 py-1.5">
        <nav className="flex flex-wrap gap-3 text-[11px] font-medium uppercase tracking-wide">
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
        <span className="font-mono text-[11px] text-neutral-500">{week.label}</span>
      </div>
      <AnalyzeView snapshot={snapshot} tab={tab} extras={extras} />
    </PageChrome>
  );
}
