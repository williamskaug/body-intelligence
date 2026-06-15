// Source registry + status semantics shared by the list_connectors MCP tool
// and the Settings "Connected data sources" panel.
//
// The old rule (fresh <2d / stale <7d / down >7d, applied to every source)
// mislabels two whole categories: a fallback source (Strava) that is
// CORRECTLY quiet reads as "down", and "manual" — which isn't a connector at
// all — gets connector freshness semantics. This registry assigns each source
// a role and derives status from it, with a heartbeat rule so a rest day on a
// primary source is not an outage.

export type SourceRole = "primary" | "fallback" | "manual" | "retired" | "unknown";

export type SourceStatus =
  | "fresh" // primary wrote / heartbeat ran within cadence
  | "stale" // primary overdue (1–2× cadence)
  | "down" // primary silent past 2× cadence
  | "idle" // fallback/unknown legitimately quiet — never red
  | "manual" // not a connector
  | "retired" // superseded by another source
  | "unknown";

export type SourceDef = {
  label: string;
  role: SourceRole;
  /** Days a primary/fallback is expected to write within. */
  expectedCadenceDays?: number;
  /** Recipes whose successful run today counts as a heartbeat even with 0 rows. */
  heartbeatRecipes?: string[];
  /** Why a source is fallback/retired — surfaced as a one-line note. */
  note?: string;
};

const REGISTRY: Record<string, SourceDef> = {
  garmin: {
    label: "Garmin Connect",
    role: "primary",
    expectedCadenceDays: 1,
    heartbeatRecipes: ["dawn-agent", "garmin-sync"],
  },
  strava: {
    label: "Strava",
    role: "fallback",
    expectedCadenceDays: 7,
    note: "Standby — only used for activities Garmin doesn't capture.",
  },
  garmin_golf: {
    label: "Garmin (golf)",
    role: "retired",
    note: "Golf now flows through Garmin (source=garmin).",
  },
  manual: { label: "Manual entry", role: "manual" },
  mfp: { label: "MyFitnessPal", role: "fallback", expectedCadenceDays: 7 },
  myfitnesspal: { label: "MyFitnessPal", role: "fallback", expectedCadenceDays: 7 },
  cronometer: { label: "Cronometer", role: "fallback", expectedCadenceDays: 7 },
  apple_health: {
    label: "Apple Health",
    role: "primary",
    expectedCadenceDays: 1,
    heartbeatRecipes: [],
  },
  whoop: { label: "Whoop", role: "primary", expectedCadenceDays: 1, heartbeatRecipes: [] },
  oura: { label: "Oura", role: "primary", expectedCadenceDays: 1, heartbeatRecipes: [] },
};

export function sourceDef(source: string): SourceDef {
  return REGISTRY[source] ?? { label: source, role: "unknown" };
}

const DAY = 86_400_000;

export function computeSourceStatus(
  def: SourceDef,
  lastWriteAt: string | null,
  heartbeatOkToday: boolean,
  now: number = Date.now(),
): SourceStatus {
  if (def.role === "manual") return "manual";
  if (def.role === "retired") return "retired";

  const ageDays = lastWriteAt ? (now - new Date(lastWriteAt).getTime()) / DAY : null;
  const cadence = def.expectedCadenceDays ?? 7;

  if (def.role === "fallback") {
    // Fallbacks are allowed to be quiet — never "down".
    if (ageDays != null && ageDays <= cadence) return "fresh";
    return "idle";
  }

  if (def.role === "primary") {
    // A successful heartbeat today means the connector is alive even if it
    // wrote zero rows (a genuine rest day is not an outage).
    if (heartbeatOkToday) return "fresh";
    if (ageDays == null) return "down";
    if (ageDays <= cadence) return "fresh";
    if (ageDays <= cadence * 2) return "stale";
    return "down";
  }

  // unknown: neutral — recent write is fresh, otherwise idle. Never red.
  if (ageDays != null && ageDays <= 7) return "fresh";
  return "idle";
}

export const STATUS_TONE: Record<
  SourceStatus,
  { label: string; classes: string }
> = {
  fresh: {
    label: "fresh",
    classes: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  idle: {
    label: "idle",
    classes: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  stale: {
    label: "stale",
    classes: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  down: {
    label: "down",
    classes: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  manual: {
    label: "manual",
    classes: "border-foreground/15 bg-muted text-muted-foreground",
  },
  retired: {
    label: "retired",
    classes: "border-foreground/15 bg-muted text-muted-foreground",
  },
  unknown: {
    label: "unknown",
    classes: "border-foreground/20 bg-muted text-muted-foreground",
  },
};
