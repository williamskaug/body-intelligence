"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV, isNavActive } from "@/lib/app/nav";
import { cn } from "@/lib/utils";

export type DawnFooter = {
  status: "ok" | "failed" | "stale" | "none";
  lastRunLabel: string | null;
};

export function AppRail({ dawn }: { dawn: DawnFooter }) {
  const pathname = usePathname() ?? "";

  return (
    <aside className="flex w-[168px] shrink-0 flex-col border-r border-neutral-200 bg-white">
      <Link
        href="/today"
        className="flex items-center gap-2 border-b border-neutral-200 px-3 py-3 text-[11px] font-semibold tracking-[0.14em]"
      >
        <span aria-hidden className="inline-block size-2 bg-foreground" />
        BODY INTELLIGENCE
      </Link>

      <nav className="flex flex-1 flex-col pt-1">
        {APP_NAV.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-between border-l-2 px-3 py-2 text-[12px] font-medium uppercase tracking-[0.14em]",
                active
                  ? "border-foreground bg-neutral-100 text-foreground"
                  : "border-transparent text-neutral-600 hover:bg-neutral-50 hover:text-foreground",
              )}
            >
              <span>{item.label}</span>
              <span className="font-mono text-[10px] text-neutral-400">{item.n}</span>
            </Link>
          );
        })}
      </nav>

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

      <Link
        href="/settings"
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
    </aside>
  );
}
