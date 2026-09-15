"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { formatHeaderDate } from "@/lib/app/dates";
import { sectionFromPath, sectionTitle } from "@/lib/app/nav";
import { WINDOW_DAYS, windowLabel, type WindowDays } from "@/lib/app/window";
import { searchApp, type SearchHit } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

export type HeaderAction = {
  label: string;
  href?: string;
  form?: string;
  type?: "submit" | "button";
};

export function AppHeader({
  todayDate,
  action,
  extra,
}: {
  todayDate: string;
  action?: HeaderAction | null;
  extra?: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const section = sectionFromPath(pathname);
  const days = parseChipDays(searchParams.get("days"));
  const focusRun = searchParams.get("focus") === "run" || searchParams.get("nogolf") === "1";

  function hrefWith(next: { days?: number; focus?: boolean }): string {
    const p = new URLSearchParams(searchParams.toString());
    if (next.days != null) p.set("days", String(next.days));
    if (next.focus === true) p.set("focus", "run");
    if (next.focus === false) p.delete("focus");
    p.delete("nogolf");
    const q = p.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="text-[15px] font-semibold tracking-tight">{sectionTitle(section)}</h1>
        <span className="hidden font-mono text-[11px] uppercase tracking-wide text-neutral-500 sm:inline">
          {formatHeaderDate(todayDate)}
        </span>
      </div>

      <SearchBox />

      <div className="ml-auto flex items-center gap-1.5">
        <div role="group" aria-label="Time range" className="hidden items-center border border-neutral-300 sm:flex">
          {WINDOW_DAYS.map((d) => {
            const active = d === days;
            return (
              <Link
                key={d}
                href={hrefWith({ days: d })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "px-2 py-1 font-mono text-[10px] font-medium",
                  active
                    ? "bg-foreground text-background"
                    : "text-neutral-600 hover:bg-neutral-50",
                )}
              >
                {windowLabel(d)}
              </Link>
            );
          })}
        </div>

        <Link
          href={hrefWith({ focus: !focusRun })}
          aria-pressed={focusRun}
          className={cn(
            "hidden border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wide md:inline",
            focusRun
              ? "border-foreground bg-foreground text-background"
              : "border-neutral-300 text-neutral-600 hover:bg-neutral-50",
          )}
        >
          Run focus
        </Link>

        {extra}
        {action ? (
          action.href ? (
            <Link
              href={action.href}
              className="border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:bg-foreground/90"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type={action.type ?? "submit"}
              form={action.form}
              className="border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:bg-foreground/90"
              onClick={
                action.type === "button"
                  ? () => router.refresh()
                  : undefined
              }
            >
              {action.label}
            </button>
          )
        ) : null}
      </div>
    </header>
  );
}

function parseChipDays(raw: string | null): WindowDays {
  const n = Number(raw);
  if (n === 7 || n === 30 || n === 90 || n === 365) return n;
  return 90;
}

function SearchBox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const destinations = useMemo(
    () => [
      { href: "/today", label: "Today" },
      { href: "/train", label: "Train" },
      { href: "/analyze?tab=build", label: "Analyze · Build" },
      { href: "/analyze?tab=fitness", label: "Analyze · Fitness" },
      { href: "/analyze?tab=long-run", label: "Analyze · Long run" },
      { href: "/analyze?tab=intensity", label: "Analyze · Intensity" },
      { href: "/analyze?tab=form", label: "Analyze · Form" },
      { href: "/analyze?tab=recovery", label: "Analyze · Recovery" },
      { href: "/analyze?tab=stats", label: "Analyze · Stats" },
      { href: "/body", label: "Body" },
      { href: "/health", label: "Health" },
      { href: "/memory", label: "Memory" },
      { href: "/agents", label: "Agents" },
      { href: "/settings", label: "Settings" },
    ],
    [],
  );

  const filteredNav = q.trim()
    ? destinations.filter((d) => d.label.toLowerCase().includes(q.trim().toLowerCase()))
    : [];

  function onChange(value: string) {
    setQ(value);
    if (value.trim().length < 2) {
      setHits(null);
      return;
    }
    start(async () => {
      try {
        const result = await searchApp(value.trim());
        setHits(result);
      } catch {
        setHits([]);
      }
    });
  }

  const open = q.trim().length > 0;

  return (
    <div className="relative min-w-0 flex-1 max-w-md">
      <input
        type="search"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search metrics, days, docs…"
        className="w-full border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-500 focus:bg-white"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQ("");
            setHits(null);
          }
        }}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 font-mono text-[10px] text-neutral-400 sm:inline">
        ⌘K
      </span>
      {open ? (
        <div className="absolute z-40 mt-1 max-h-80 w-full overflow-auto border border-neutral-200 bg-white shadow-sm">
          {filteredNav.length > 0 ? (
            <ul className="border-b border-neutral-100 py-1">
              {filteredNav.map((d) => (
                <li key={d.href}>
                  <button
                    type="button"
                    className="flex w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-50"
                    onClick={() => {
                      router.push(d.href);
                      setQ("");
                      setHits(null);
                    }}
                  >
                    {d.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {pending ? (
            <p className="px-3 py-2 text-[11px] text-neutral-400">Searching…</p>
          ) : hits && hits.length > 0 ? (
            <ul className="py-1">
              {hits.map((h) => (
                <li key={`${h.kind}-${h.id}`}>
                  <Link
                    href={hitHref(h)}
                    className="block px-3 py-1.5 hover:bg-neutral-50"
                    onClick={() => {
                      setQ("");
                      setHits(null);
                    }}
                  >
                    <div className="font-mono text-[10px] uppercase text-neutral-400">
                      {h.kind}
                      {h.date ? ` · ${h.date}` : ""}
                      {h.path ? ` · ${h.path}` : ""}
                    </div>
                    <div className="truncate text-xs">{h.snippet}</div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : q.trim().length >= 2 && !pending ? (
            <p className="px-3 py-2 text-[11px] text-neutral-400">No matches</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function hitHref(h: SearchHit): string {
  if (h.kind === "document" && h.path) return `/memory?path=${encodeURIComponent(h.path)}`;
  if (h.kind === "workout") return `/train?workout=${h.id}`;
  if (h.kind === "health_event") return `/health?event=${h.id}`;
  if (h.kind === "daily_entry" && h.date) return `/body`;
  return "/today";
}
