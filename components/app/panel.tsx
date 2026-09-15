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
    <section id={id} className={cn("bi-panel bg-white", className)}>
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
    <header className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
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
      <div className="bi-label">{label}</div>
      <div className="mt-1 font-mono text-xl tabular-nums leading-none tracking-tight">{value}</div>
      {sub ? <div className="mt-1 text-[10px] text-neutral-500">{sub}</div> : null}
    </>
  );
  if (href) {
    return (
      <a href={href} className="bi-panel block px-3 py-2.5 hover:bg-neutral-50">
        {inner}
      </a>
    );
  }
  return <div className="bi-panel px-3 py-2.5">{inner}</div>;
}
