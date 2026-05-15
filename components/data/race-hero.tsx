import Link from "next/link";
import {
  daysUntil,
  nextRace,
  parseCurrentSection,
  parseGoalsMarkdown,
} from "@/lib/memory/parse-goals";

type Props = {
  goalsContent: string;
  currentContent: string;
  today: string;
};

export function RaceHero({ goalsContent, currentContent, today }: Props) {
  const races = parseGoalsMarkdown(goalsContent);
  const race = nextRace(races, today, "A");
  const block = parseCurrentSection(currentContent, "Active block");
  const week = parseCurrentSection(currentContent, "This week");
  const hasContent = race != null || block.length > 0 || week.length > 0;

  if (!hasContent) {
    return (
      <section className="rounded-2xl border border-dashed bg-muted/20 px-5 py-4 text-sm shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">
            Tell BI what you&apos;re training for
          </h2>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            no race yet
          </span>
        </div>
        <p className="mt-1 text-muted-foreground">
          Open GOALS.md and CURRENT.md to give Claude a target to anchor reasoning around — race date, tier, current block, this week&apos;s plan.
        </p>
        <Link
          href="/agents?id=onboarding"
          className="mt-3 inline-flex items-center text-xs font-medium underline-offset-2 hover:underline"
        >
          Run onboarding →
        </Link>
      </section>
    );
  }

  return (
    <section className="grid gap-4 rounded-2xl border bg-gradient-to-br from-sky-500/10 via-card to-card px-5 py-4 shadow-sm sm:grid-cols-3">
      <RaceColumn race={race} today={today} />
      <BlockColumn block={block} />
      <WeekColumn week={week} />
    </section>
  );
}

function RaceColumn({
  race,
  today,
}: {
  race: ReturnType<typeof nextRace>;
  today: string;
}) {
  if (!race) {
    return (
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Next race
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          No future race in GOALS.md.
        </div>
        <Link
          href="/data"
          className="mt-2 inline-flex text-xs underline-offset-2 hover:underline"
        >
          Edit GOALS.md ↓
        </Link>
      </div>
    );
  }
  const days = daysUntil(race.date, today);
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Next race {race.tier ? `· ${race.tier}-race` : ""}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-3xl tabular-nums">{Math.max(0, days)}</span>
        <span className="text-xs text-muted-foreground">days</span>
      </div>
      <div className="mt-1 text-sm font-medium">{race.name}</div>
      <div className="text-xs text-muted-foreground">
        {race.date}
        {race.distance ? ` · ${race.distance}` : ""}
      </div>
      {race.goal ? (
        <div className="mt-1 line-clamp-2 text-xs text-foreground/80">
          Goal: {race.goal}
        </div>
      ) : null}
    </div>
  );
}

function BlockColumn({ block }: { block: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Active block
      </div>
      {block.length > 0 ? (
        <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-foreground/90">
          {block}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          No active block in CURRENT.md.
        </p>
      )}
    </div>
  );
}

function WeekColumn({ week }: { week: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        This week
      </div>
      {week.length > 0 ? (
        <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-foreground/90">
          {week}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          The weekly review recipe writes here every Sunday.
        </p>
      )}
    </div>
  );
}
