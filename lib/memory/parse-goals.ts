// Parsers for GOALS.md and CURRENT.md. Kept structurally identical so the
// race-countdown recipe and the dashboard race-hero strip see the same data.
//
// Race block convention (from GOALS.md):
//
//   ## Race: <name>
//   - Date: YYYY-MM-DD
//   - Tier: A | B | C
//   - Distance: <free text>
//   - Goal: <free text>
//   - Notes: <free text>

export type RaceTier = "A" | "B" | "C";

export type ParsedRace = {
  name: string;
  date: string;
  tier: RaceTier | null;
  distance: string | null;
  goal: string | null;
  notes: string | null;
};

const RACE_BLOCK_RE = /^##\s+Race:\s+(.+)$/gim;
const FIELD_RE = /^-\s*([A-Za-z][A-Za-z ]*?):\s*(.+)$/gim;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseGoalsMarkdown(content: string): ParsedRace[] {
  if (!content) return [];
  const races: ParsedRace[] = [];
  // Walk through the file by race-block start, slicing each block from the
  // header line to the next race header or EOF. Lines inside HTML comments
  // are stripped before parsing so the commented example doesn't return.
  const stripped = content.replace(/<!--[\s\S]*?-->/g, "");
  const matches = Array.from(stripped.matchAll(RACE_BLOCK_RE));
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const name = m[1]!.trim();
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : stripped.length;
    const body = stripped.slice(start, end);
    const fields: Record<string, string> = {};
    for (const f of body.matchAll(FIELD_RE)) {
      fields[f[1]!.trim().toLowerCase()] = f[2]!.trim();
    }
    const date = fields.date;
    if (!date || !ISO_DATE_RE.test(date)) continue;
    const tierRaw = fields.tier?.trim().toUpperCase();
    const tier: RaceTier | null =
      tierRaw === "A" || tierRaw === "B" || tierRaw === "C" ? tierRaw : null;
    races.push({
      name,
      date,
      tier,
      distance: fields.distance ?? null,
      goal: fields.goal ?? null,
      notes: fields.notes ?? null,
    });
  }
  return races;
}

export function nextRace(
  races: ReadonlyArray<ParsedRace>,
  today: string,
  preferredTier: RaceTier = "A",
): ParsedRace | null {
  const future = races
    .filter((r) => r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (future.length === 0) return null;
  const preferred = future.find((r) => r.tier === preferredTier);
  if (preferred) return preferred;
  return future[0]!;
}

// Parse a goal time string into seconds. Handles "sub-3", "sub-3:00",
// "2:59:00", "sub-1:30", "1:29" (H:MM for race goals). Null when unparseable.
export function parseGoalSeconds(goal: string | null | undefined): number | null {
  if (!goal) return null;
  const g = goal.toLowerCase().replace(/sub[-\s]*/g, "").trim();
  const hms = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(g);
  if (hms) {
    const a = Number(hms[1]);
    const b = Number(hms[2]);
    const c = hms[3] != null ? Number(hms[3]) : null;
    // Three parts → H:MM:SS; two parts → H:MM (race goals are given in hours).
    return c != null ? a * 3600 + b * 60 + c : a * 3600 + b * 60;
  }
  const hoursOnly = /^(\d{1,2})\s*h?$/.exec(g);
  if (hoursOnly) return Number(hoursOnly[1]) * 3600;
  return null;
}

// Map a race distance string to the matching capacity race-prediction metric.
export function racePredictionKey(distance: string | null | undefined): string | null {
  if (!distance) return null;
  const d = distance.toLowerCase();
  if (/marathon|42/.test(d) && !/half|21/.test(d)) return "capacity_race_pred_marathon_s";
  if (/half|21/.test(d)) return "capacity_race_pred_half_s";
  if (/10\s?k|10000|\b10\b/.test(d)) return "capacity_race_pred_10k_s";
  if (/\b5\s?k\b|5000|\b5\b/.test(d)) return "capacity_race_pred_5k_s";
  return null;
}

export function daysUntil(dateISO: string, today: string): number {
  const a = new Date(`${today}T00:00:00Z`);
  const b = new Date(`${dateISO}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// CURRENT.md sections — extract the contents of "## This week" and "## Active block".
// Returns the raw text, no further parsing. Empty string if section missing.
export function parseCurrentSection(
  content: string,
  heading: string,
): string {
  if (!content) return "";
  const stripped = content.replace(/<!--[\s\S]*?-->/g, "");
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, "im");
  const m = re.exec(stripped);
  if (!m) return "";
  return m[1]!.trim();
}
