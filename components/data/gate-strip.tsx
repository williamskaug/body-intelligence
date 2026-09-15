import { GATE_FILL_CLASS, type Gate } from "@/lib/data-display/derived";
import { cn } from "@/lib/utils";

export type GateStripDay = {
  date: string;
  gate: Gate | null;
};

// Row of colored squares — one per day — showing readiness-gate history.
// Days without a derived row render as faint placeholders.
export function GateStrip({
  days,
  size = "sm",
  nowrap = false,
  className,
}: {
  days: ReadonlyArray<GateStripDay>;
  size?: "sm" | "md";
  nowrap?: boolean;
  className?: string;
}) {
  const box = size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
  return (
    <div
      className={cn(
        nowrap
          ? "flex shrink-0 items-center gap-[3px]"
          : "grid grid-cols-[repeat(auto-fill,minmax(0.7rem,1fr))] gap-1",
        className,
      )}
      role="img"
      aria-label="Readiness gate history"
    >
      {days.map((d) => (
        <span
          key={d.date}
          title={`${d.date}${d.gate ? ` — ${d.gate}` : ""}`}
          className={`${box} rounded-[3px] ${
            d.gate ? GATE_FILL_CLASS[d.gate] : "bg-muted-foreground/15"
          }`}
        />
      ))}
    </div>
  );
}
