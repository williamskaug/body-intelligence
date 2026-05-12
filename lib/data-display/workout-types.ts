// Per-`type` display map for workouts. Solves the "—" problem where a
// strength row sitting next to a run looks broken because half its columns
// are empty. Pick three stats per type that are actually meaningful.

export type StatKey =
  | "duration_min"
  | "distance_km"
  | "avg_hr"
  | "max_hr"
  | "rpe"
  | "pace"
  | "shoes";

type TypeDisplay = {
  stats: ReadonlyArray<StatKey>;
  color: string; // tailwind classes for the type chip
};

// Keys are matched against lowercased, trimmed `workouts.type`.
const TYPE_DISPLAY: Record<string, TypeDisplay> = {
  run: { stats: ["duration_min", "distance_km", "avg_hr"], color: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30" },
  trail: { stats: ["duration_min", "distance_km", "avg_hr"], color: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30" },
  walk: { stats: ["duration_min", "distance_km"], color: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30" },
  hike: { stats: ["duration_min", "distance_km"], color: "bg-lime-600/15 text-lime-700 dark:text-lime-400 border-lime-600/30" },
  ride: { stats: ["duration_min", "distance_km", "avg_hr"], color: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" },
  cycling: { stats: ["duration_min", "distance_km", "avg_hr"], color: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" },
  bike: { stats: ["duration_min", "distance_km", "avg_hr"], color: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" },
  swim: { stats: ["duration_min", "distance_km", "avg_hr"], color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30" },
  lift: { stats: ["duration_min", "rpe"], color: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30" },
  strength: { stats: ["duration_min", "rpe"], color: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30" },
  yoga: { stats: ["duration_min", "rpe"], color: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/30" },
  mobility: { stats: ["duration_min"], color: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/30" },
  row: { stats: ["duration_min", "distance_km", "avg_hr"], color: "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30" },
  ski: { stats: ["duration_min", "distance_km"], color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" },
  golf: { stats: ["duration_min"], color: "bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30" },
};

const DEFAULT_DISPLAY: TypeDisplay = {
  stats: ["duration_min", "distance_km", "rpe"],
  color: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};

export function displayForType(type: string): TypeDisplay {
  const key = type.trim().toLowerCase();
  return TYPE_DISPLAY[key] ?? DEFAULT_DISPLAY;
}

// Stable color for the workout-type distribution donut. Falls back to a hash
// over the type string so unmapped types still get distinct hues.
export function chartColorForType(type: string): string {
  const key = type.trim().toLowerCase();
  if (key in CHART_COLORS) return CHART_COLORS[key]!;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 65% 55%)`;
}

const CHART_COLORS: Record<string, string> = {
  run: "hsl(200 80% 55%)",
  trail: "hsl(200 80% 55%)",
  walk: "hsl(220 10% 60%)",
  hike: "hsl(100 50% 45%)",
  ride: "hsl(25 90% 55%)",
  cycling: "hsl(25 90% 55%)",
  bike: "hsl(25 90% 55%)",
  swim: "hsl(190 80% 50%)",
  lift: "hsl(270 65% 60%)",
  strength: "hsl(270 65% 60%)",
  yoga: "hsl(300 60% 60%)",
  mobility: "hsl(300 60% 60%)",
  row: "hsl(170 65% 45%)",
  ski: "hsl(210 75% 55%)",
  golf: "hsl(140 50% 45%)",
};

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
    case "pace":
      if (w.duration_min == null || w.distance_km == null) return null;
      const km = Number(w.distance_km);
      if (km <= 0) return null;
      const minPerKm = w.duration_min / km;
      const m = Math.floor(minPerKm);
      const s = Math.round((minPerKm - m) * 60);
      return { label: "/km", value: `${m}:${String(s).padStart(2, "0")}` };
    case "shoes":
      return w.shoes ? { label: "shoes", value: w.shoes } : null;
  }
}
