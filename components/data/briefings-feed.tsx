import Link from "next/link";
import { Markdown } from "@/components/data/markdown";

export type BriefingsFeedProps = {
  briefings: Array<{
    path: string;
    date: string;
    updated_at: string;
    content: string | null;
  }>;
};

const MAX_OLDER = 10;

export function BriefingsFeed({ briefings }: BriefingsFeedProps) {
  if (briefings.length === 0) return null;

  // Most recent first by date.
  const sorted = [...briefings].sort((a, b) => (a.date < b.date ? 1 : -1));
  const [latest, ...older] = sorted;
  const visibleOlder = older.slice(0, MAX_OLDER);
  const overflow = older.length - visibleOlder.length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">Daily briefings</h2>
        <span className="text-xs text-muted-foreground">
          Written by your dawn-agent every morning
        </span>
      </div>

      {latest ? (
        <article className="rounded-2xl border bg-card p-5 shadow-sm">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <span className="font-mono text-sm font-medium tabular-nums">
              {latest.date}
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
            <p className="text-sm text-muted-foreground">(empty briefing)</p>
          )}
        </article>
      ) : null}

      {visibleOlder.length > 0 ? (
        <div className="flex flex-col divide-y rounded-xl border bg-card/60 shadow-sm">
          {visibleOlder.map((b) => (
            <Link
              key={b.path}
              href={`/data/docs/${b.path}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
            >
              <span className="font-mono tabular-nums">{b.date}</span>
              <span className="text-xs text-muted-foreground">Open →</span>
            </Link>
          ))}
        </div>
      ) : null}

      {overflow > 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          and {overflow} older
        </p>
      ) : null}
    </section>
  );
}
