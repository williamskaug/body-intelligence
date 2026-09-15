import Link from "next/link";
import { GATE_CALL, GATE_LABEL, type DerivedDailyRow, type Gate } from "@/lib/data-display/derived";
import { GateStrip } from "@/components/data/gate-strip";
import { formatZScore } from "@/lib/app/format";
import { cn } from "@/lib/utils";

export type StatusStripProps = {
  derived: DerivedDailyRow | null;
  todayDate: string;
  hrvMs: number | null;
  rhrBpm: number | null;
  consecutiveGreen: number;
  todayWorkout: { type: string; title: string } | null;
  briefingPath: string | null;
  gateHistory: Array<{ date: string; gate: Gate | null }>;
  detailsHref?: string;
};

export function StatusStrip({
  derived,
  todayDate,
  hrvMs,
  rhrBpm,
  consecutiveGreen,
  todayWorkout,
  briefingPath,
  gateHistory,
  detailsHref = "/analyze",
}: StatusStripProps) {
  const gate = derived?.readiness_gate ?? null;
  const stale = derived != null && derived.date !== todayDate;

  return (
    <div className="flex h-9 shrink-0 items-center gap-3 overflow-x-auto border-b border-neutral-200 bg-white px-3 text-[11px]">
      {gate ? (
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-semibold uppercase tracking-wide",
              gate === "green" && "text-emerald-700",
              gate === "amber" && "text-amber-700",
              gate === "red" && "text-rose-700",
            )}
          >
            {GATE_LABEL[gate]}
          </span>
          <span className="font-medium">{GATE_CALL[gate]}</span>
          {stale ? (
            <span className="text-[10px] text-amber-700">from {derived?.date}</span>
          ) : null}
        </span>
      ) : (
        <span className="text-neutral-500">No readiness gate yet</span>
      )}

      <span className="hidden text-neutral-300 sm:inline">·</span>
      <span className="hidden items-center gap-2 text-neutral-600 sm:flex">
        <span>
          HRV {hrvMs ?? "—"}
          {derived?.hrv_z ? (
            <span className="ml-1 text-neutral-400">{formatZScore(derived.hrv_z)}</span>
          ) : null}
        </span>
        <span>·</span>
        <span>
          RHR {rhrBpm ?? "—"}
          {derived?.rhr_z ? (
            <span className="ml-1 text-neutral-400">{formatZScore(derived.rhr_z)}</span>
          ) : null}
        </span>
        <span>·</span>
        <span>
          debt {derived?.sleep_debt_7d_min != null ? Math.round(derived.sleep_debt_7d_min) : "—"}
        </span>
        {consecutiveGreen > 0 ? (
          <>
            <span>·</span>
            <span>
              {consecutiveGreen}
              {ordinal(consecutiveGreen)}
            </span>
          </>
        ) : null}
      </span>

      <span className="ml-auto flex items-center gap-3">
        {todayWorkout ? (
          <span className="hidden items-center gap-1.5 lg:flex">
            <span className="text-[10px] uppercase tracking-wide text-neutral-400">Today</span>
            <span className="border border-neutral-300 px-1 font-mono text-[10px] uppercase">
              {todayWorkout.type}
            </span>
            <span className="truncate font-medium">{todayWorkout.title}</span>
          </span>
        ) : null}
        <Link href={detailsHref} className="text-[10px] uppercase tracking-wide text-neutral-500 hover:text-foreground">
          Details
        </Link>
        <GateStrip days={gateHistory} size="sm" />
        {briefingPath ? (
          <Link
            href={`/memory?path=${encodeURIComponent(briefingPath)}`}
            className="text-[10px] uppercase tracking-wide text-neutral-500 hover:text-foreground"
          >
            Briefing
          </Link>
        ) : null}
      </span>
    </div>
  );
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function consecutiveGreenDays(
  history: Array<{ date: string; gate: Gate | null }>,
): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.gate === "green") n += 1;
    else break;
  }
  return n;
}
