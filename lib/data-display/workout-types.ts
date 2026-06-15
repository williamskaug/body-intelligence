// Display registry for the canonical workout-type vocabulary. The canonical
// set and alias normalization live in lib/mcp/tools/shared.ts (the MCP write
// boundary); this file maps each canonical type to its display name, short
// calendar label, chip classes, chart color, and the three stats worth
// showing. All UI consumers go through normalizeType() so legacy rows that
// predate the backfill still resolve.

import { normalizeWorkoutType } from "@/lib/mcp/tools/shared";

export type StatKey =
  | "duration_min"
  | "distance_km"
  | "avg_hr"
  | "max_hr"
  | "rpe"
  | "pace"
  | "shoes";

type TypeDisplay = {
  displayName: string;
  /** Short uppercase label for tight surfaces (calendar pills). */
  shortLabel: string;
  stats: ReadonlyArray<StatKey>;
  /** Tailwind classes for the type chip. */
  color: string;
  /** Stable color for donut / stacked charts. */
  chartColor: string;
};

const SKY = "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30";
const ORANGE = "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
const VIOLET = "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30";
const FUCHSIA = "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/30";

export const WORKOUT_TYPES: Record<string, TypeDisplay> = {
  run: {
    displayName: "Run",
    shortLabel: "RUN",
    stats: ["duration_min", "distance_km", "avg_hr"],
    color: SKY,
    chartColor: "hsl(200 80% 55%)",
  },
  trail_run: {
    displayName: "Trail run",
    shortLabel: "TRAIL",
    stats: ["duration_min", "distance_km", "avg_hr"],
    color: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30",
    chartColor: "hsl(160 65% 42%)",
  },
  ride: {
    displayName: "Ride",
    shortLabel: "RIDE",
    stats: ["duration_min", "distance_km", "avg_hr"],
    color: ORANGE,
    chartColor: "hsl(25 90% 55%)",
  },
  gravel_ride: {
    displayName: "Gravel ride",
    shortLabel: "GRVL",
    stats: ["duration_min", "distance_km", "avg_hr"],
    color: ORANGE,
    chartColor: "hsl(35 80% 50%)",
  },
  mtb: {
    displayName: "MTB",
    shortLabel: "MTB",
    stats: ["duration_min", "distance_km", "avg_hr"],
    color: ORANGE,
    chartColor: "hsl(15 75% 50%)",
  },
  golf: {
    displayName: "Golf",
    shortLabel: "GOLF",
    stats: ["duration_min"],
    color: "bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30",
    chartColor: "hsl(140 50% 45%)",
  },
  strength: {
    displayName: "Strength",
    shortLabel: "LIFT",
    stats: ["duration_min", "rpe"],
    color: VIOLET,
    chartColor: "hsl(270 65% 60%)",
  },
  walk: {
    displayName: "Walk",
    shortLabel: "WALK",
    stats: ["duration_min", "distance_km"],
    color: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    chartColor: "hsl(220 10% 60%)",
  },
  hike: {
    displayName: "Hike",
    shortLabel: "HIKE",
    stats: ["duration_min", "distance_km"],
    color: "bg-lime-600/15 text-lime-700 dark:text-lime-400 border-lime-600/30",
    chartColor: "hsl(100 50% 45%)",
  },
  swim: {
    displayName: "Swim",
    shortLabel: "SWIM",
    stats: ["duration_min", "distance_km", "avg_hr"],
    color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
    chartColor: "hsl(190 80% 50%)",
  },
  row: {
    displayName: "Row",
    shortLabel: "ROW",
    stats: ["duration_min", "distance_km", "avg_hr"],
    color: "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30",
    chartColor: "hsl(170 65% 45%)",
  },
  yoga: {
    displayName: "Yoga",
    shortLabel: "YOGA",
    stats: ["duration_min", "rpe"],
    color: FUCHSIA,
    chartColor: "hsl(300 60% 60%)",
  },
  mobility: {
    displayName: "Mobility",
    shortLabel: "MOB",
    stats: ["duration_min"],
    color: FUCHSIA,
    chartColor: "hsl(315 55% 60%)",
  },
  xc_ski: {
    displayName: "XC ski",
    shortLabel: "XC",
    stats: ["duration_min", "distance_km", "avg_hr"],
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    chartColor: "hsl(210 75% 55%)",
  },
  orienteering: {
    displayName: "Orienteering",
    shortLabel: "O",
    stats: ["duration_min", "distance_km", "avg_hr"],
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    chartColor: "hsl(45 85% 50%)",
  },
  padel: {
    displayName: "Padel",
    shortLabel: "PADL",
    stats: ["duration_min"],
    color: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
    chartColor: "hsl(350 70% 58%)",
  },
};

const DEFAULT_DISPLAY: Omit<TypeDisplay, "displayName" | "shortLabel"> = {
  stats: ["duration_min", "distance_km", "rpe"],
  color: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  chartColor: "hsl(220 10% 60%)",
};

export function normalizeType(raw: string): string {
  return normalizeWorkoutType(raw);
}

export function displayForType(type: string): TypeDisplay {
  const key = normalizeType(type);
  const known = WORKOUT_TYPES[key];
  if (known) return known;
  return {
    ...DEFAULT_DISPLAY,
    displayName: humanize(key),
    shortLabel: key.replace(/_/g, "").slice(0, 4).toUpperCase(),
  };
}

export function displayNameForType(type: string): string {
  return displayForType(type).displayName;
}

export function shortLabelForType(type: string): string {
  return displayForType(type).shortLabel;
}

// Stable color for donut / stacked charts. Falls back to a hash over the
// normalized type so unmapped types still get distinct hues.
export function chartColorForType(type: string): string {
  const key = normalizeType(type);
  const known = WORKOUT_TYPES[key];
  if (known) return known.chartColor;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 65% 55%)`;
}

function humanize(key: string): string {
  const words = key.split("_").filter(Boolean);
  if (words.length === 0) return key;
  return words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function formatStat(
  key: StatKey,
  w: {
    duration_min: number | null;
    distance_km: string | null;
    avg_hr: number | null;
    max_hr: number | null;
    rpe: number | null;
    shoes: string | null;
  },
): { label: string; value: string } | null {
  switch (key) {
    case "duration_min":
      return w.duration_min != null ? { label: "min", value: String(w.duration_min) } : null;
    case "distance_km":
      return w.distance_km != null ? { label: "km", value: Number(w.distance_km).toFixed(1) } : null;
    case "avg_hr":
      return w.avg_hr != null ? { label: "avg HR", value: String(w.avg_hr) } : null;
    case "max_hr":
      return w.max_hr != null ? { label: "max HR", value: String(w.max_hr) } : null;
    case "rpe":
      return w.rpe != null ? { label: "RPE", value: `${w.rpe}/10` } : null;
    case "pace": {
      if (w.duration_min == null || w.distance_km == null) return null;
      const km = Number(w.distance_km);
      if (km <= 0) return null;
      const minPerKm = w.duration_min / km;
      const m = Math.floor(minPerKm);
      const s = Math.round((minPerKm - m) * 60);
      return { label: "/km", value: `${m}:${String(s).padStart(2, "0")}` };
    }
    case "shoes":
      return w.shoes ? { label: "shoes", value: w.shoes } : null;
  }
}
