import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("bi-panel min-w-0 bg-white", className)}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  hint,
  href,
  hrefLabel,
  extra,
}: {
  title: string;
  hint?: string;
  href?: string;
  hrefLabel?: string;
      extra?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-2 border-b border-neutral-200 px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <h2 className="min-w-0 text-[13px] font-semibold tracking-tight text-pretty [overflow-wrap:break-word]">
          {title}
        </h2>
        {hint ? (
          <span
            title={hint}
            className="inline-flex size-3.5 cursor-help items-center justify-center rounded-full border border-neutral-300 text-[9px] text-neutral-400"
          >
            ?
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-wide text-neutral-500">
        {extra}
        {href ? (
          <a href={href} className="hover:text-foreground">
            {hrefLabel ?? "→"}
          </a>
        ) : null}
      </div>
    </header>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-6 text-center text-xs text-muted-foreground">{children}</p>
  );
}

export function TypeChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center border border-neutral-300 px-1 py-px font-mono text-[10px] uppercase tracking-wide text-neutral-700">
      {children}
    </span>
  );
}

export function Kpi({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div className="bi-label truncate" title={label}>
        {label}
      </div>
      <div className="mt-1 font-mono text-lg tabular-nums leading-none tracking-tight whitespace-nowrap @7xl:text-xl">
        {value}
      </div>
      {sub ? (
        <div
          className="mt-1 min-w-0 text-[10px] leading-snug text-pretty text-neutral-500 [overflow-wrap:break-word] line-clamp-2"
          title={typeof sub === "string" ? sub : undefined}
        >
          {sub}
        </div>
      ) : null}
    </>
  );
  if (href) {
    return (
      <a href={href} className="bi-panel block min-w-0 px-2.5 py-2 hover:bg-neutral-50 @7xl:px-3 @7xl:py-2.5">
        {inner}
      </a>
    );
  }
  return <div className="bi-panel min-w-0 px-2.5 py-2 @7xl:px-3 @7xl:py-2.5">{inner}</div>;
}
