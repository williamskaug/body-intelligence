import { GATE_FILL_CLASS, type Gate } from "@/lib/data-display/derived";

export type GateStripDay = {
  date: string;
  gate: Gate | null;
};

// Row of colored squares — one per day — showing readiness-gate history.
// Days without a derived row render as faint placeholders.
export function GateStrip({
  days,
  size = "sm",
}: {
  days: ReadonlyArray<GateStripDay>;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-2.5 w-2.5" : "h-4 w-4";
  return (
    <div className="flex flex-wrap items-center gap-[3px]" role="img" aria-label="Readiness gate history">
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
