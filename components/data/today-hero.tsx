import Link from "next/link";
import { GateStrip } from "@/components/data/gate-strip";
import {
  bandClass,
  classify,
  type Baseline,
} from "@/lib/data-display/baseline";
import {
  classifyDerivedFreshness,
  formatZ,
  GATE_CALL,
  GATE_CARD_CLASS,
  GATE_LABEL,
  GATE_PILL_CLASS,
  signalFlags,
  type DerivedDailyRow,
  type Gate,
} from "@/lib/data-display/derived";

export type TodayHeroProps = {
  todayDate: string;
  derived: DerivedDailyRow | null; // latest derived row, any date
  briefingPath: string | null; // "briefings/2026-06-12.md" when today's/latest briefing exists
  briefingContent: string | null; // latest briefing markdown, for the lead when the gate is dark
  vitals: {
    sleepH: number | null;
    hrvMs: number | null;
    rhrBpm: number | null;
    hrvBaseline: Baseline | null;
    rhrBaseline: Baseline | null;
    sleepBaseline: Baseline | null;
  };
  race: { name: string; date: string; daysOut: number } | null;
  milestone: { label: string; date: string; daysOut: number } | null;
  gateHistory: Array<{ date: string; gate: Gate | null }>; // last 14 days
  hasDawnAgent: boolean;
};

export function TodayHero({
  todayDate,
  derived,
  briefingPath,
  briefingContent,
  vitals,
  race,
  milestone,
  gateHistory,
  hasDawnAgent,
}: TodayHeroProps) {
  const freshness = classifyDerivedFreshness(derived, todayDate);

  if (derived && freshness !== "absent") {
    return (
      <VerdictHero
        derived={derived}
        stale={freshness === "stale"}
        briefingPath={briefingPath}
        vitals={vitals}
        race={race}
        milestone={milestone}
        gateHistory={gateHistory}
      />
    );
  }

  if (briefingPath) {
    return (
      <BriefingOnlyHero
        briefingPath={briefingPath}
        briefingContent={briefingContent}
        vitals={vitals}
        race={race}
        milestone={milestone}
        gateHistory={gateHistory}
      />
    );
  }

  return (
    <OnboardingHero
      vitals={vitals}
      hasDawnAgent={hasDawnAgent}
      race={race}
      milestone={milestone}
    />
  );
}

function VerdictHero({
  derived,
  stale,
  briefingPath,
  vitals,
  race,
  milestone,
  gateHistory,
}: {
  derived: DerivedDailyRow;
  stale: boolean;
  briefingPath: string | null;
  vitals: TodayHeroProps["vitals"];
  race: TodayHeroProps["race"];
  milestone: TodayHeroProps["milestone"];
  gateHistory: TodayHeroProps["gateHistory"];
}) {
  const gate = derived.readiness_gate;
  // A derived row without a gate is degenerate — treat its body as signals
  // only, never fabricate a verdict.
  const cardClass = stale || !gate ? "border-border bg-card" : GATE_CARD_CLASS[gate];
  const flags = signalFlags(derived);
  const flaggedCount = flags.filter((f) => f.flagged).length;

  return (
    <section
      className={`rounded-2xl border px-5 py-4 shadow-sm ${cardClass} ${
        stale ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {gate ? (
              <span
                className={`rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide ${GATE_PILL_CLASS[gate]}`}
              >
                {GATE_LABEL[gate]}
              </span>
            ) : null}
            {stale ? (
              <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                from {derived.date} — dawn-agent hasn&apos;t run today
              </span>
            ) : null}
          </div>
          {gate ? (
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight">
              Today&apos;s call: {GATE_CALL[gate]}
            </h2>
          ) : (
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight">
              Signals for {derived.date}
            </h2>
          )}
          {derived.gate_reason ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {derived.gate_reason}
            </p>
          ) : null}
        </div>
        {briefingPath ? (
          <Link
            href={`/data/docs/${briefingPath}`}
            className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
          >
            Read full briefing →
          </Link>
        ) : null}
      </div>

      <VitalsChips derived={derived} vitals={vitals} />

      <ContextChips race={race} milestone={milestone} gateHistory={gateHistory} />

      <details className="group mt-3 text-xs">
        <summary className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground">
          <span className="transition-transform group-open:rotate-90">›</span>
          Why{flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ""}
        </summary>
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {flags.map((f) => (
              <span
                key={f.key}
                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                  f.flagged
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {f.label}
                {f.flagged ? " ⚠" : ""}
              </span>
            ))}
          </div>
          <dl className="grid gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-2">
            {derived.sleep_debt_7d_min != null ? (
              <div className="flex justify-between gap-2">
                <dt>Sleep debt 7d</dt>
                <dd className="font-mono tabular-nums text-foreground/80">
                  {Math.round(derived.sleep_debt_7d_min)} min
                </dd>
              </div>
            ) : null}
            {derived.illness_composite ? (
              <div className="flex justify-between gap-2">
                <dt>Illness composite</dt>
                <dd>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${GATE_PILL_CLASS[derived.illness_composite]}`}
                  >
                    {GATE_LABEL[derived.illness_composite]}
                  </span>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </details>
    </section>
  );
}

function BriefingOnlyHero({
  briefingPath,
  briefingContent,
  vitals,
  race,
  milestone,
  gateHistory,
}: {
  briefingPath: string;
  briefingContent: string | null;
  vitals: TodayHeroProps["vitals"];
  race: TodayHeroProps["race"];
  milestone: TodayHeroProps["milestone"];
  gateHistory: TodayHeroProps["gateHistory"];
}) {
  const lead = briefingLead(briefingContent);
  return (
    <section className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Today&apos;s briefing is ready
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your dawn-agent wrote a briefing but no structured gate yet.
          </p>
        </div>
        <Link
          href={`/data/docs/${briefingPath}`}
          className="shrink-0 rounded-lg border border-foreground bg-foreground px-3 py-1.5 text-xs font-medium text-background"
        >
          Open today&apos;s briefing →
        </Link>
      </div>
      {lead ? (
        <p className="mt-2 border-l-2 border-foreground/20 pl-3 text-sm text-foreground/90">
          {lead}
        </p>
      ) : null}
      <VitalsChips derived={null} vitals={vitals} />
      <ContextChips race={race} milestone={milestone} gateHistory={gateHistory} />
    </section>
  );
}

// Pull a short plain-text lead from the briefing markdown (preferring the
// "Today's Call" section). Displaying Claude's authored text — the app does not
// author or parse a gate/verdict here.
function briefingLead(content: string | null): string | null {
  if (!content) return null;
  const call = /##\s*Today'?s Call\s*\n+([\s\S]*?)(?:\n#{1,2}\s|$)/i.exec(content);
  let text = call ? call[1]! : content;
  text = text
    .replace(/[#*_>`]/g, "")
    .replace(/\s*\n\s*/g, " ")
    .trim();
  if (!text) return null;
  return text.length > 320 ? `${text.slice(0, 317).trimEnd()}…` : text;
}

function OnboardingHero({
  vitals,
  hasDawnAgent,
  race,
  milestone,
}: {
  vitals: TodayHeroProps["vitals"];
  hasDawnAgent: boolean;
  race: TodayHeroProps["race"];
  milestone: TodayHeroProps["milestone"];
}) {
  const anyVitals =
    vitals.sleepH != null || vitals.hrvMs != null || vitals.rhrBpm != null;
  return (
    <section className="rounded-2xl border border-dashed bg-muted/20 px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Install the dawn agent for a daily readiness call
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasDawnAgent
              ? "Your dawn-agent hasn't written a readiness gate yet — it computes one each morning from your overnight vitals."
              : "A scheduled dawn-agent reads your overnight vitals and writes a green / amber / red training ceiling each morning."}
          </p>
        </div>
        <Link
          href="/agents"
          className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
        >
          Browse agents →
        </Link>
      </div>
      {anyVitals ? <VitalsChips derived={null} vitals={vitals} /> : null}
      {race || milestone ? (
        <ContextChips race={race} milestone={milestone} gateHistory={[]} />
      ) : null}
    </section>
  );
}

function VitalsChips({
  derived,
  vitals,
}: {
  derived: DerivedDailyRow | null;
  vitals: TodayHeroProps["vitals"];
}) {
  const chips: Array<{
    label: string;
    value: string;
    z: string | null;
    tone: string;
  }> = [];

  const sleep = vitalChip(
    "Sleep",
    vitals.sleepH,
    "h",
    derived?.sleep_z ?? null,
    vitals.sleepBaseline,
    true,
    1,
  );
  if (sleep) chips.push(sleep);

  const hrv = vitalChip(
    "HRV",
    vitals.hrvMs,
    "ms",
    derived?.hrv_z ?? null,
    vitals.hrvBaseline,
    true,
    0,
  );
  if (hrv) chips.push(hrv);

  const rhr = vitalChip(
    "RHR",
    vitals.rhrBpm,
    "bpm",
    derived?.rhr_z ?? null,
    vitals.rhrBaseline,
    false,
    0,
  );
  if (rhr) chips.push(rhr);

  // Sleep debt is the signal most likely to drive a RED gate, yet it was buried
  // in the "Why" fold. Surface it as a glanceable chip so a red verdict is
  // legible at a glance. Thresholds are display bands, not a verdict — the gate
  // itself is the agent's authored call.
  if (derived?.sleep_debt_7d_min != null) {
    const debt = Math.round(derived.sleep_debt_7d_min);
    const tone =
      debt >= 300
        ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400"
        : debt >= 180
          ? bandClass("warn")
          : bandClass("neutral");
    chips.push({ label: "Sleep debt", value: `${debt} min`, z: null, tone });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((c) => (
        <div
          key={c.label}
          className={`flex items-baseline gap-1.5 rounded-md border px-2 py-1 text-xs ${c.tone}`}
        >
          <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
            {c.label}
          </span>
          <span className="font-mono tabular-nums">{c.value}</span>
          {c.z ? <span className="text-[10px] opacity-70">{c.z}</span> : null}
        </div>
      ))}
    </div>
  );
}

function vitalChip(
  label: string,
  value: number | null,
  unit: string,
  derivedZ: string | null,
  baseline: Baseline | null,
  higherIsBetter: boolean,
  decimals: number,
): { label: string; value: string; z: string | null; tone: string } | null {
  if (value == null) return null;
  // Prefer the agent-authored z from the derived row; fall back to a baseline
  // z computed from the window the page already loaded.
  const z =
    formatZ(derivedZ) ??
    (baseline && baseline.sd > 0
      ? formatZ((value - baseline.mean) / baseline.sd)
      : null);
  const cls = classify(value, baseline, higherIsBetter);
  return {
    label,
    value: `${value.toFixed(decimals)} ${unit}`,
    z,
    tone: bandClass(cls.direction),
  };
}

function ContextChips({
  race,
  milestone,
  gateHistory,
}: {
  race: TodayHeroProps["race"];
  milestone: TodayHeroProps["milestone"];
  gateHistory: TodayHeroProps["gateHistory"];
}) {
  const hasStrip = gateHistory.some((d) => d.gate != null);
  if (!race && !milestone && !hasStrip) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      {race ? (
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{race.name}</span>
          <span className="font-mono tabular-nums">
            {Math.max(0, race.daysOut)}d
          </span>
        </span>
      ) : null}
      {milestone ? (
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{milestone.label}</span>
          {milestone.daysOut < 0 ? (
            <span className="font-mono tabular-nums text-rose-500">
              overdue {Math.abs(milestone.daysOut)}d
            </span>
          ) : (
            <span className="font-mono tabular-nums">{milestone.daysOut}d</span>
          )}
        </span>
      ) : null}
      {hasStrip ? (
        <span className="ml-auto inline-flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            14d
          </span>
          <GateStrip days={gateHistory} size="sm" />
        </span>
      ) : null}
    </div>
  );
}
