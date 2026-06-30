// Parser for THRESHOLDS.md. The capacity-sync recipe writes this file and the
// dawn-agent / race-countdown recipes read it back to set workout targets, so
// the block shapes are a contract. Kept structurally close to parse-goals.ts.
//
// Block convention (from the seeded template):
//
//   ## Run thresholds
//   - LTHR: <bpm>
//   - Threshold pace: <m:ss/km>
//   - Updated: YYYY-MM-DD
//
//   ## Run HR zones
//   - Z1: <lo>-<hi> bpm
//   ...
//
//   ## Bike thresholds
//   - FTP: <watts>
//   - Updated: YYYY-MM-DD
//
//   ## Bike power zones
//   - Z1: <lo>-<hi> W
//   ...

export type ThresholdZone = { zone: number; lo: number; hi: number };

export type ParsedThresholds = {
  run: {
    lthr: number | null;
    thresholdPace: string | null;
    updated: string | null;
    zones: ThresholdZone[];
  };
  bike: {
    ftp: number | null;
    updated: string | null;
    zones: ThresholdZone[];
  };
};

const FIELD_RE = /^-\s*([A-Za-z][A-Za-z ]*?):\s*(.+)$/gim;
const ZONE_RE = /^-\s*Z(\d)\s*:\s*(\d+)\s*[-–]\s*(\d+)/gim;

// Slice the body of a "## <heading>" section up to the next "## " or EOF.
// HTML comments are stripped first so commented hints never parse.
function sectionBody(content: string, heading: string): string {
  const stripped = content.replace(/<!--[\s\S]*?-->/g, "");
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^##\\s+${escaped}\\s*$`, "im");
  const m = re.exec(stripped);
  if (!m) return "";
  const start = m.index + m[0].length;
  const rest = stripped.slice(start);
  const next = /^##\s/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function numberField(fields: Record<string, string>, key: string): number | null {
  const raw = fields[key];
  if (!raw) return null;
  const n = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const f of body.matchAll(FIELD_RE)) {
    const key = f[1]!.trim().toLowerCase();
    // Skip zone bullets — they're parsed separately by ZONE_RE.
    if (/^z\d$/.test(key)) continue;
    fields[key] = f[2]!.trim();
  }
  return fields;
}

function parseZones(body: string): ThresholdZone[] {
  const zones: ThresholdZone[] = [];
  for (const z of body.matchAll(ZONE_RE)) {
    const zone = Number(z[1]);
    const lo = Number(z[2]);
    const hi = Number(z[3]);
    if (Number.isFinite(zone) && Number.isFinite(lo) && Number.isFinite(hi)) {
      zones.push({ zone, lo, hi });
    }
  }
  return zones.sort((a, b) => a.zone - b.zone);
}

export function parseThresholds(content: string): ParsedThresholds {
  const empty: ParsedThresholds = {
    run: { lthr: null, thresholdPace: null, updated: null, zones: [] },
    bike: { ftp: null, updated: null, zones: [] },
  };
  if (!content) return empty;

  const runFields = parseFields(sectionBody(content, "Run thresholds"));
  const bikeFields = parseFields(sectionBody(content, "Bike thresholds"));

  return {
    run: {
      lthr: numberField(runFields, "lthr"),
      thresholdPace: runFields["threshold pace"] ?? null,
      updated: runFields["updated"] ?? null,
      zones: parseZones(sectionBody(content, "Run HR zones")),
    },
    bike: {
      ftp: numberField(bikeFields, "ftp"),
      updated: bikeFields["updated"] ?? null,
      zones: parseZones(sectionBody(content, "Bike power zones")),
    },
  };
}
