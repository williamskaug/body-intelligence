import { Sparkline } from "@/components/data/sparkline";
import {
  daysBetween,
  eventThread,
  type ThreadedHealthEvent,
} from "@/lib/data-display/health-events";

export type HealthThreadsProps = {
  events: ThreadedHealthEvent[];
  todayDate: string;
};

export function HealthThreads({ events, todayDate }: HealthThreadsProps) {
  if (events.length === 0) return null;

  const active = events.filter((e) => e.resolved_date == null);
  const resolved = events.filter((e) => e.resolved_date != null);

  // Active first, most recent onset on top; resolved collapse to muted lines.
  const sortedActive = [...active].sort((a, b) => (a.date < b.date ? 1 : -1));
  const sortedResolved = [...resolved].sort((a, b) =>
    (a.resolved_date ?? a.date) < (b.resolved_date ?? b.date) ? 1 : -1,
  );

  return (
    <section id="health-threads" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">Health threads</h2>
        <span className="text-xs text-muted-foreground">
          {active.length} active · {resolved.length} resolved
        </span>
      </div>

      {sortedActive.map((event) => (
        <ActiveCard key={event.id} event={event} todayDate={todayDate} />
      ))}

      {sortedResolved.length > 0 ? (
        <div className="flex flex-col gap-1">
          {sortedResolved.map((event) => (
            <ResolvedLine key={event.id} event={event} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

const RAIL: Record<"low" | "mid" | "high", string> = {
  low: "bg-emerald-500/70",
  mid: "bg-amber-500/70",
  high: "bg-rose-500/70",
};

function severityTier(severity: number | null): "low" | "mid" | "high" {
  if (severity == null) return "mid";
  if (severity <= 2) return "low";
  if (severity === 3) return "mid";
  return "high";
}

function ActiveCard({
  event,
  todayDate,
}: {
  event: ThreadedHealthEvent;
  todayDate: string;
}) {
  const thread = eventThread(event);
  const tier = severityTier(event.severity);
  const ageDays = daysBetween(event.date, todayDate);
  const title = `${event.kind.toUpperCase()} · ${event.body_part ?? "unspecified"}`;

  const severityValues = event.updates
    .map((u) => u.severity_at_time)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const showSparkline = severityValues.length >= 2;

  const milestoneDays =
    event.next_milestone_date != null
      ? daysBetween(todayDate, event.next_milestone_date)
      : null;

  const latestUpdate = thread.updates[0] ?? null;

  return (
    <div className="flex items-stretch gap-3 rounded-xl border bg-card shadow-sm">
      <span aria-hidden className={`w-[3px] rounded-l-xl ${RAIL[tier]}`} />
      <div className="min-w-0 flex-1 py-3 pr-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{title}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              active {Math.max(0, ageDays)}d
            </span>
            {event.severity != null ? (
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                sev {event.severity}/5
              </span>
            ) : null}
          </div>
          {event.next_milestone ? (
            <span className="rounded-md border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
              {event.next_milestone}
              {milestoneDays != null ? ` · ${milestoneDays}d` : ""}
            </span>
          ) : null}
        </div>

        {showSparkline ? (
          <div className="mt-2 text-foreground/70">
            <Sparkline
              values={severityValues}
              width={220}
              height={32}
              yDomain={[1, 5]}
              ariaLabel={`${title} severity over time`}
            />
          </div>
        ) : null}

        {latestUpdate ? (
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">
              {latestUpdate.label}
            </span>{" "}
            <span className="line-clamp-2">{latestUpdate.note}</span>
          </div>
        ) : thread.summary ? (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            {thread.summary}
          </p>
        ) : null}

        {thread.updates.length > 0 ? (
          <details className="group mt-2 text-xs">
            <summary className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground">
              <span className="transition-transform group-open:rotate-90">›</span>
              Thread ({thread.updates.length} update
              {thread.updates.length === 1 ? "" : "s"})
            </summary>
            {thread.summary ? (
              <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-muted-foreground">
                {thread.summary}
              </p>
            ) : null}
            <ul className="mt-2 space-y-2 border-l border-dashed pl-3">
              {thread.updates.map((u, i) => (
                <li key={`${u.label}-${i}`} className="flex gap-2">
                  <span
                    aria-hidden
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      RAIL[severityTier(u.severity ?? null)]
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-foreground/80">
                        {u.label}
                      </span>
                      {u.severity != null ? (
                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                          sev {u.severity}/5
                        </span>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {u.note}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function ResolvedLine({ event }: { event: ThreadedHealthEvent }) {
  const title = `${event.kind} · ${event.body_part ?? "unspecified"}`;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/10 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="truncate">{title}</span>
      <span className="shrink-0 font-mono tabular-nums">
        resolved {event.resolved_date}
      </span>
    </div>
  );
}
