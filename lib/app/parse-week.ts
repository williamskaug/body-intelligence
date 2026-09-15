import { parseCurrentSection } from "@/lib/memory/parse-goals";

export type WeekPlanItem = {
  dow: string;
  type: string | null;
  title: string;
  done: boolean;
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const TYPE_RE = /\b(run|ride|str|strength|walk|golf|swim|yoga|mobility|hike|lift)\b/i;

/**
 * Best-effort parse of CURRENT.md "This week" into weekday rows.
 * Freeform markdown — missing/unparseable days are omitted, never invented.
 */
export function parseWeekPlan(currentMd: string): {
  items: WeekPlanItem[];
  raw: string;
  block: string;
} {
  const raw = parseCurrentSection(currentMd, "This week");
  const block = parseCurrentSection(currentMd, "Active block");
  if (!raw) return { items: [], raw, block };

  const items: WeekPlanItem[] = [];
  const lines = raw.split(/\n/);
  for (const line of lines) {
    const trimmed = line.replace(/^[-*]\s+/, "").trim();
    if (!trimmed) continue;
    const dowMatch = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b[:\s.\-–—]*/i.exec(trimmed);
    if (!dowMatch) continue;
    const rest = trimmed.slice(dowMatch[0].length).trim();
    const typeMatch = TYPE_RE.exec(rest);
    let type: string | null = typeMatch ? typeMatch[1]!.toLowerCase() : null;
    if (type === "str" || type === "lift") type = "strength";
    const done = /\b(done|✓|✔)\b/i.test(rest);
    items.push({
      dow: capitalizeDow(dowMatch[1]!),
      type,
      title: rest.replace(/\s*[·|].*$/, "").trim() || rest,
      done,
    });
  }

  // If we didn't get weekday bullets, still return the raw section for display.
  if (items.length === 0) {
    for (const dow of DOW) {
      const re = new RegExp(`^[-*]?\\s*${dow}\\b[:\\s.\\-–—]*(.+)$`, "im");
      const m = re.exec(raw);
      if (m) {
        items.push({
          dow,
          type: null,
          title: m[1]!.trim(),
          done: false,
        });
      }
    }
  }

  return { items, raw, block };
}

function capitalizeDow(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1, 3).toLowerCase();
}
