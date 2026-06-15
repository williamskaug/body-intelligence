// Types + display helpers for the agent-computed derived layer
// (derived_daily table). The app renders these values verbatim — they are
// Claude-authored judgments parked in the DB by the user's scheduled agent.
// The app never invents a gate verdict of its own.

export type Gate = "green" | "amber" | "red";

export type DerivedDailyRow = {
  id: string;
  date: string;
  readiness_gate: Gate | null;
  gate_reason: string | null;
  illness_composite: Gate | null;
  skin_temp_flag: boolean | null;
  hrv_flag: boolean | null;
  rhr_flag: boolean | null;
  resp_flag: boolean | null;
  hrv_z: string | null;
  rhr_z: string | null;
  sleep_z: string | null;
  sleep_debt_7d_min: number | null;
  sleep_need_min: number | null;
  acute_load_7d: string | null;
  chronic_load_28d: string | null;
  days_to_race: number | null;
  computed_by: string;
  computed_at: string;
};

export const GATE_LABEL: Record<Gate, string> = {
  green: "GREEN",
  amber: "AMBER",
  red: "RED",
};

export const GATE_CALL: Record<Gate, string> = {
  green: "Quality allowed",
  amber: "Easy only",
  red: "Rest",
};

/** Card / hero surfaces. */
export const GATE_CARD_CLASS: Record<Gate, string> = {
  green: "border-emerald-500/40 bg-emerald-500/10",
  amber: "border-amber-500/40 bg-amber-500/10",
  red: "border-rose-500/40 bg-rose-500/10",
};

export const GATE_PILL_CLASS: Record<Gate, string> = {
  green:
    "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  amber:
    "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  red: "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

/** Small solid square / dot fills (gate strips, calendar dots). */
export const GATE_FILL_CLASS: Record<Gate, string> = {
  green: "bg-emerald-500/80",
  amber: "bg-amber-500/80",
  red: "bg-rose-500/80",
};

export function formatZ(z: string | number | null): string | null {
  if (z == null) return null;
  const n = Number(z);
  if (!Number.isFinite(n)) return null;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `z ${sign}${Math.abs(n).toFixed(1)}`;
}

export type SignalFlag = { key: string; label: string; flagged: boolean };

export function signalFlags(row: DerivedDailyRow): SignalFlag[] {
  return [
    { key: "skin_temp", label: "Skin temp", flagged: row.skin_temp_flag === true },
    { key: "hrv", label: "HRV", flagged: row.hrv_flag === true },
    { key: "rhr", label: "RHR", flagged: row.rhr_flag === true },
    { key: "resp", label: "Respiration", flagged: row.resp_flag === true },
  ];
}

/**
 * Freshness ladder for the hero: a gate is only "today's call" when the row
 * is for today; rows up to 3 days old render dimmed and dated; anything
 * older is treated as absent.
 */
export function classifyDerivedFreshness(
  row: DerivedDailyRow | null,
  todayDate: string,
): "fresh" | "stale" | "absent" {
  if (!row) return "absent";
  if (row.date === todayDate) return "fresh";
  const ageDays =
    (Date.parse(todayDate) - Date.parse(row.date)) / (24 * 60 * 60 * 1000);
  return ageDays <= 3 ? "stale" : "absent";
}
