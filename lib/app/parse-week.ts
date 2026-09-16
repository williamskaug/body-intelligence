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
  blockLabel: string | null;
} {
  const raw = parseCurrentSection(currentMd, "This week");
  const block = parseCurrentSection(currentMd, "Active block");
  if (!raw) return { items: [], raw, block, blockLabel: blockLabel(block) };

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

  return { items, raw, block, blockLabel: blockLabel(block) };
}

const BLOCK_MAX = 42;

/** Word-safe clip. Never cuts inside a token when a nearby space exists. */
export function clipAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, Math.max(1, max - 1));
  const sp = slice.lastIndexOf(" ");
  const cut = sp >= Math.floor(max * 0.45) ? slice.slice(0, sp) : slice;
  return `${cut.trimEnd()}…`;
}

/** One-line excerpt of a CURRENT.md section for panels — never a document dump. */
export function planExcerpt(raw: string, max = 160): string {
  const stripped = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return "";
  return clipAtWord(stripped, max);
}

/** Short chip for KPI / race-trajectory. Never returns a document body. */
export function blockLabel(block: string, maxLen = BLOCK_MAX): string | null {
  const stripped = block
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return null;
  if (stripped.length <= maxLen && !/[.!?]/.test(stripped)) return stripped;

  const weekOf = /week\s+(\d+)\s+of\s+(\d+)/i.exec(stripped);
  const wkSlash = /wk\.?\s*(\d+)\s*\/\s*(\d+)/i.exec(stripped);
  const week = weekOf
    ? `wk ${weekOf[1]}/${weekOf[2]}`
    : wkSlash
      ? `wk ${wkSlash[1]}/${wkSlash[2]}`
      : null;

  const beforeWeek = stripped
    .replace(/,?\s*week\s+\d+\s+of\s+\d+.*$/i, "")
    .replace(/,?\s*wk\.?\s*\d+\s*\/\s*\d+.*$/i, "")
    .trim();
  const name = (beforeWeek.split(/\s+[—–]\s+/)[0] ?? beforeWeek).split(/[,(]/)[0]!.trim();

  if (name && week && name.length <= 24) {
    const combined = `${name} · ${week}`;
    return combined.length <= maxLen ? combined : clipAtWord(combined, maxLen);
  }
  if (name && name.length <= maxLen && name.length < stripped.length) {
    return week && !name.toLowerCase().includes("wk") ? `${name} · ${week}` : name;
  }
  const firstSentence = stripped.split(/(?<=\.)\s+/)[0] ?? stripped;
  if (firstSentence.length <= maxLen) return firstSentence;
  return clipAtWord(stripped, maxLen);
}

function capitalizeDow(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1, 3).toLowerCase();
}
