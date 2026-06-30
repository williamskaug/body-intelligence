import Link from "next/link";
import { Markdown } from "@/components/data/markdown";

export type InsightDoc = {
  path: string;
  label: string;
  updated_at: string;
  content: string | null;
};

const MAX_OLDER = 8;

// Surfaces Claude-authored interpretation docs (insights/YYYY-Www.md). The app
// renders the prose; it never authors its own reading. Placed above the
// deterministic stat bands so the separation is explicit.
export function InsightsFeed({ insights }: { insights: InsightDoc[] }) {
  if (insights.length === 0) return null;

  const sorted = [...insights].sort((a, b) => (a.path < b.path ? 1 : -1));
  const [latest, ...older] = sorted;
  const visibleOlder = older.slice(0, MAX_OLDER);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">Insights</h2>
        <span className="text-xs text-muted-foreground">
          Claude&apos;s reading of the stats below — written by your insights recipe
        </span>
      </div>

      {latest ? (
        <article className="rounded-2xl border bg-card p-5 shadow-sm">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <span className="font-mono text-sm font-medium tabular-nums">
              {latest.label}
            </span>
            <Link
              href={`/data/docs/${latest.path}`}
              className="text-xs font-medium underline-offset-2 hover:underline"
            >
              Open →
            </Link>
          </header>
          {latest.content ? (
            <Markdown>{latest.content}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">(empty insight)</p>
          )}
        </article>
      ) : null}

      {visibleOlder.length > 0 ? (
        <div className="flex flex-col divide-y rounded-xl border bg-card/60 shadow-sm">
          {visibleOlder.map((d) => (
            <Link
              key={d.path}
              href={`/data/docs/${d.path}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
            >
              <span className="font-mono tabular-nums">{d.label}</span>
              <span className="text-xs text-muted-foreground">Open →</span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
