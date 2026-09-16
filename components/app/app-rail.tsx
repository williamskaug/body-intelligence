"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { APP_NAV, isNavActive } from "@/lib/app/nav";
import { cn } from "@/lib/utils";

export type DawnFooter = {
  status: "ok" | "failed" | "stale" | "none";
  lastRunLabel: string | null;
};

export function AppRail({ dawn }: { dawn: DawnFooter }) {
  return (
    <aside className="flex w-44 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <Link
        href="/today"
        className="flex min-w-0 items-center gap-2 border-b border-neutral-200 px-3 py-3"
      >
        <span aria-hidden className="inline-block size-2 shrink-0 bg-foreground" />
        <span className="min-w-0 text-[10px] font-semibold leading-tight tracking-[0.12em]">
          BODY INTELLIGENCE
        </span>
      </Link>

      <Suspense fallback={<RailNav q="" />}>
        <RailNavWithWindow />
      </Suspense>

      <div className="border-t border-neutral-200 px-3 py-2 text-[10px] text-neutral-500">
        <span
          className={cn(
            "mr-1 inline-block size-1.5 rounded-full",
            dawn.status === "ok"
              ? "bg-emerald-500"
              : dawn.status === "failed"
                ? "bg-rose-500"
                : dawn.status === "stale"
                  ? "bg-amber-500"
                  : "bg-neutral-300",
          )}
        />
        dawn-agent
        {dawn.lastRunLabel ? ` · ${dawn.lastRunLabel}` : ""}
      </div>

      <Suspense fallback={<SettingsLink q="" />}>
        <SettingsLinkWithWindow />
      </Suspense>
    </aside>
  );
}

function useWindowQuery(): string {
  const searchParams = useSearchParams();
  const p = new URLSearchParams();
  const days = searchParams.get("days");
  const focus = searchParams.get("focus");
  if (days) p.set("days", days);
  if (focus) p.set("focus", focus);
  const q = p.toString();
  return q ? `?${q}` : "";
}

function RailNavWithWindow() {
  return <RailNav q={useWindowQuery()} />;
}

function SettingsLinkWithWindow() {
  return <SettingsLink q={useWindowQuery()} />;
}

function RailNav({ q }: { q: string }) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex min-w-0 flex-1 flex-col pt-1">
      {APP_NAV.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={`${item.href}${q}`}
            prefetch
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 items-center justify-between gap-2 border-l-2 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em]",
              active
                ? "border-foreground bg-neutral-100 text-foreground"
                : "border-transparent text-neutral-600 hover:bg-neutral-50 hover:text-foreground",
            )}
          >
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 font-mono text-[10px] text-neutral-400">{item.n}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SettingsLink({ q }: { q: string }) {
  const pathname = usePathname() ?? "";
  return (
    <Link
      href={`/settings${q}`}
      prefetch
      aria-current={pathname.startsWith("/settings") ? "page" : undefined}
      className={cn(
        "border-t border-neutral-200 px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em]",
        pathname.startsWith("/settings")
          ? "bg-neutral-100 text-foreground"
          : "text-neutral-600 hover:bg-neutral-50 hover:text-foreground",
      )}
    >
      Settings
    </Link>
  );
}
