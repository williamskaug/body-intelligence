"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  closeHealthEvent,
  saveHealthEventMilestone,
  saveHealthEventUpdate,
} from "@/app/(app)/actions";
import { Markdown } from "@/components/data/markdown";
import { eventThread, type ThreadedHealthEvent } from "@/lib/data-display/health-events";
import { daysBetween } from "@/lib/app/dates";
import { cn } from "@/lib/utils";
import { LogEventDialog } from "./log-event-dialog";

export function HealthView({
  events,
  todayDate,
  selectedId,
  healthLog,
}: {
  events: ThreadedHealthEvent[];
  todayDate: string;
  selectedId: string | null;
  healthLog: string | null;
}) {
  const open = events.filter((e) => e.resolved_date == null);
  const resolved = events.filter((e) => e.resolved_date != null);
  const selected =
    events.find((e) => e.id === selectedId) ??
    open[0] ??
    events[0] ??
    null;

  return (
    <div className="grid h-full min-h-0 min-w-0 gap-px bg-neutral-200 @3xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] @7xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,22rem)]">
      <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white">
        <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
          <h2 className="text-[13px] font-semibold">Events</h2>
          <span className="font-mono text-[10px] uppercase text-neutral-500">
            {open.length} open · {resolved.length} resolved
          </span>
        </div>
        <ul className="min-h-0 flex-1 overflow-auto">
          {events.map((e) => {
            const active = selected?.id === e.id;
            const isOpen = e.resolved_date == null;
            return (
              <li key={e.id}>
                <Link
                  href={`/health?event=${e.id}`}
                  className={cn(
                    "flex items-start justify-between gap-2 px-3 py-2 text-[12px]",
                    active ? "bg-foreground text-background" : "hover:bg-neutral-50",
                  )}
                >
                  <span className="min-w-0 text-pretty [overflow-wrap:break-word]">
                    <span className="mr-2 font-mono text-[10px] opacity-70">{e.date}</span>
                    {e.body_part ?? e.kind}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[10px] uppercase",
                      active
                        ? "opacity-80"
                        : isOpen
                          ? "text-amber-700"
                          : "text-neutral-400",
                    )}
                  >
                    {isOpen ? "open" : "resolved"}
                  </span>
                </Link>
              </li>
            );
          })}
          {events.length === 0 ? (
            <li className="px-3 py-8 text-center text-[12px] text-neutral-400">No health events yet.</li>
          ) : null}
        </ul>
        <div className="border-t border-neutral-200 px-3 py-3">
          <LogEventDialog todayDate={todayDate} />
        </div>
      </aside>
      <section className="min-h-0 min-w-0 overflow-hidden bg-white">
        {selected ? (
          <EventDetail event={selected} todayDate={todayDate} />
        ) : (
          <p className="px-6 py-12 text-center text-sm text-neutral-500">
            Log an injury, illness, or symptom to start a thread.
          </p>
        )}
      </section>
      <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white @3xl:col-span-2 @7xl:col-span-1">
        <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
          <h2 className="font-mono text-[12px] font-semibold">HEALTH_LOG.md</h2>
          <span className="text-[10px] uppercase tracking-wide text-neutral-400">append-only</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
          {healthLog ? (
            <Markdown>{healthLog}</Markdown>
          ) : (
            <p className="text-[12px] text-neutral-400">No HEALTH_LOG.md yet.</p>
          )}
        </div>
        <div className="border-t border-neutral-200 px-3 py-2">
          <Link
            href="/memory?path=HEALTH_LOG.md"
            className="text-[10px] uppercase tracking-wide text-neutral-500 hover:text-foreground"
          >
            Open in memory →
          </Link>
        </div>
      </aside>
    </div>
  );
}

function EventDetail({ event, todayDate }: { event: ThreadedHealthEvent; todayDate: string }) {
  const thread = eventThread(event);
  const open = event.resolved_date == null;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingMilestone, setEditingMilestone] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-pretty [overflow-wrap:break-word]">
            {event.body_part ?? event.kind}
            {event.kind !== "injury" ? ` — ${event.kind}` : ""}
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-neutral-500">
            since {event.date}
            {event.severity != null ? ` · sev ${event.severity}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
            open
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-neutral-300 text-neutral-500",
          )}
        >
          {open ? `open · sev ${event.severity ?? "—"}` : "resolved"}
        </span>
      </header>

      {open ? (
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-2 text-[12px]">
          <div>
            <span className="text-[10px] uppercase tracking-wide text-neutral-400">Next milestone</span>
            <div>
              {event.next_milestone ?? "—"}
              {event.next_milestone_date ? ` · ${event.next_milestone_date}` : ""}
            </div>
          </div>
          <button
            type="button"
            className="text-[10px] uppercase tracking-wide text-neutral-500 hover:text-foreground"
            onClick={() => setEditingMilestone((v) => !v)}
          >
            Edit
          </button>
        </div>
      ) : null}

      {editingMilestone && open ? (
        <form
          className="grid min-w-0 grid-cols-1 gap-2 border-b border-neutral-100 px-4 py-2 text-[12px] @3xl:grid-cols-[minmax(0,1fr)_8rem_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const milestone = String(fd.get("next_milestone") ?? "").trim();
            const milestoneDate = String(fd.get("next_milestone_date") ?? "").trim();
            start(async () => {
              try {
                await saveHealthEventMilestone({
                  id: event.id,
                  next_milestone: milestone || null,
                  next_milestone_date: milestoneDate || null,
                });
                setEditingMilestone(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : "save failed");
              }
            });
          }}
        >
          <input
            name="next_milestone"
            defaultValue={event.next_milestone ?? ""}
            placeholder="Pain-free strides"
            className="border border-neutral-300 px-2 py-1"
          />
          <input
            name="next_milestone_date"
            type="date"
            defaultValue={event.next_milestone_date ?? ""}
            className="border border-neutral-300 px-2 py-1"
          />
          <button type="submit" className="border border-foreground bg-foreground px-2 py-1 text-[11px] text-background">
            Save
          </button>
        </form>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <div className="text-[10px] uppercase tracking-wide text-neutral-400">Thread</div>
        {thread.summary ? (
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">{thread.summary}</p>
        ) : null}
        <ol className="mt-3 space-y-4">
          {thread.updates.map((u, i) => (
            <li key={`${u.label}-${i}`}>
              <div className="font-mono text-[11px] text-neutral-500">
                {u.label}
                {u.severity != null ? `  sev ${u.severity}` : ""}
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed">{u.note}</p>
            </li>
          ))}
        </ol>
        {thread.updates.length === 0 && !thread.summary ? (
          <p className="mt-4 text-[12px] text-neutral-400">No updates yet.</p>
        ) : null}
      </div>

      {open ? (
        <div className="border-t border-neutral-200 px-4 py-3">
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const note = String(fd.get("note") ?? "").trim();
              const sevRaw = String(fd.get("severity") ?? "").trim();
              if (!note) return;
              setError(null);
              start(async () => {
                try {
                  await saveHealthEventUpdate({
                    event_id: event.id,
                    date: todayDate,
                    note,
                    severity_at_time: sevRaw ? Number(sevRaw) : undefined,
                  });
                  e.currentTarget.reset();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "save failed");
                }
              });
            }}
          >
            <label className="text-[10px] uppercase tracking-wide text-neutral-400">
              Add update
              <textarea
                name="note"
                rows={3}
                placeholder="What changed today?"
                className="mt-1 w-full border border-neutral-300 px-2 py-1 text-[12px]"
              />
            </label>
            <div className="flex items-center gap-2">
              <input
                name="severity"
                type="number"
                min={1}
                max={5}
                placeholder="sev"
                className="w-16 border border-neutral-300 px-2 py-1 font-mono text-[12px]"
              />
              <button
                type="submit"
                disabled={pending}
                className="border border-foreground bg-foreground px-3 py-1 text-[11px] font-medium text-background disabled:opacity-50"
              >
                Add update
              </button>
              <button
                type="button"
                disabled={pending}
                className="border border-neutral-300 px-3 py-1 text-[11px] font-medium disabled:opacity-50"
                onClick={() => {
                  start(async () => {
                    try {
                      await closeHealthEvent({ id: event.id, resolved_date: todayDate });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "resolve failed");
                    }
                  });
                }}
              >
                Resolve
              </button>
            </div>
            {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
            <p className="text-[10px] text-neutral-400">
              Open {Math.max(0, daysBetween(event.date, todayDate))} d
            </p>
          </form>
        </div>
      ) : (
        <p className="border-t border-neutral-200 px-4 py-3 text-[12px] text-neutral-500">
          Resolved {event.resolved_date}.
        </p>
      )}
    </div>
  );
}
