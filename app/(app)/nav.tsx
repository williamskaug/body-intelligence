"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/data", label: "Data" },
  { href: "/agents", label: "Agents" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppNav({ email }: { email: string }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-6">
          <Link
            href="/data"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span
              aria-hidden
              className="inline-block size-2 rounded-full bg-foreground"
            />
            <span className="hidden sm:inline">Body Intelligence</span>
            <span className="sm:hidden">BI</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {links.map((l) => (
              <NavLink
                key={l.href}
                href={l.href}
                active={isActive(pathname, l.href)}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="hidden max-w-[14rem] truncate text-muted-foreground lg:inline">
            {email}
          </span>
          <form action="/auth/signout" method="post" className="hidden md:block">
            <button
              type="submit"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Sign out
            </button>
          </form>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "md:hidden",
            )}
          >
            <span aria-hidden className="relative block h-3 w-4">
              <span
                className={cn(
                  "absolute left-0 top-0 h-0.5 w-4 bg-current transition-transform",
                  open && "translate-y-[5px] rotate-45",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-[5px] h-0.5 w-4 bg-current transition-opacity",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-[10px] h-0.5 w-4 bg-current transition-transform",
                  open && "-translate-y-[5px] -rotate-45",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t bg-background md:hidden"
        >
          <nav className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-3 text-sm">
            {links.map((l) => (
              <NavLink
                key={l.href}
                href={l.href}
                active={isActive(pathname, l.href)}
                onClick={() => setOpen(false)}
                fullWidth
              >
                {l.label}
              </NavLink>
            ))}
            <div className="mt-2 flex items-center justify-between border-t pt-3">
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Sign out
                </button>
              </form>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
  onClick,
  fullWidth,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  fullWidth?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 transition-colors",
        fullWidth && "block",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
