import Link from "next/link";
import { DocEditor } from "@/components/data/doc-editor";
import {
  looksLikeTemplate,
  meaningfulWordCount,
} from "@/lib/memory/template-detection";

export type DocumentRow = {
  path: string;
  /**
   * Optional — the page slims its query for the list view. When absent, word
   * count and template detection are skipped (the card degrades gracefully).
   */
  content?: string | null;
  updated_at: string;
};

type Role = "index" | "foundation" | "plan" | "log" | "derived" | "reference";

type StandardMeta = {
  role: Role;
  description: string;
  /**
   * Expected refresh cadence in days. When the doc is older than its slack
   * window, a staleness badge appears. GOALS.md is a soft nudge (no amber).
   */
  expectedCadenceDays?: number;
};

const STANDARD_DOCS: Record<string, StandardMeta> = {
  "MEMORY.md": { role: "index", description: "One-liner index over the other files." },
  "PROFILE.md": { role: "foundation", description: "Anthropometrics, training history, baseline." },
  "PRINCIPLES.md": { role: "foundation", description: "Training philosophy and decision rules." },
  "GOALS.md": { role: "plan", description: "A/B/C races and performance benchmarks.", expectedCadenceDays: 60 },
  "CURRENT.md": { role: "plan", description: "This week's plan and active training block.", expectedCadenceDays: 7 },
  "HEALTH_LOG.md": { role: "log", description: "Injuries, illnesses, niggles. Append-only." },
  "BASELINES.md": {
    role: "derived",
    description: "Agent-computed baselines — z-scores, sleep debt, illness composite.",
    expectedCadenceDays: 1,
  },
  "NUTRITION.md": { role: "reference", description: "What works, what wrecks you. Dietary notes." },
  "EQUIPMENT.md": { role: "reference", description: "Gear inventory, mileage, and condition." },
};

const ROLE_ORDER: Role[] = ["index", "foundation", "plan", "log", "derived", "reference"];

const ROLE_LABELS: Record<Role, string> = {
  index: "Index",
  foundation: "Foundation",
  plan: "Plan",
  log: "Log",
  derived: "Derived",
  reference: "Reference",
};

const ROLE_ACCENT: Record<Role, string> = {
  index: "bg-foreground/40",
  foundation: "bg-sky-500/60",
  plan: "bg-emerald-500/60",
  log: "bg-amber-500/60",
  derived: "bg-cyan-500/60",
  reference: "bg-violet-500/50",
};

const FOLDER_DESCRIPTIONS: Record<string, string> = {
  daily: "Per-day vendor scores from sync",
  recipes: "Your agent recipes",
  briefings: "Daily agent briefings",
};

export function Documents({
  rows,
  excludeFolders,
}: {
  rows: ReadonlyArray<DocumentRow>;
  excludeFolders?: string[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-8 text-center text-sm text-muted-foreground shadow-sm">
        No memory documents yet — these are normally seeded on signup.
      </div>
    );
  }

  // Normalize excluded folder names so both "briefings" and "briefings/" work.
  const excluded = new Set(
    (excludeFolders ?? []).map((f) => f.replace(/\/$/, "")),
  );

  const { topLevel, folders } = splitByFolder(rows);
  const sortedTop = sortByRole(topLevel);
  const folderEntries = Array.from(folders.entries())
    .filter(([folder]) => !excluded.has(folder))
    .sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {sortedTop.map((doc) => (
          <DocCard key={doc.path} doc={doc} />
        ))}
      </div>
      {folderEntries.map(([folder, docs]) => (
        <FolderSection key={folder} folder={folder} docs={docs} />
      ))}
    </div>
  );
}

function DocCard({ doc }: { doc: DocumentRow }) {
  const meta = STANDARD_DOCS[doc.path];
  const role = meta?.role ?? "reference";
  const hasContent = doc.content != null;
  const isTemplate = hasContent ? looksLikeTemplate(doc.content ?? "") : false;
  const subtitle = meta?.description ?? (hasContent ? previewFirstLine(doc.content ?? "") : doc.path);
  const words = hasContent ? meaningfulWordCount(doc.content ?? "") : null;
  const stale = staleness(doc.updated_at, meta?.expectedCadenceDays);
  return (
    <details className="group rounded-xl border bg-card shadow-sm transition-shadow open:shadow-md">
      <summary className="flex cursor-pointer items-stretch gap-3 py-3 pr-4 text-sm">
        <span aria-hidden className={`w-[3px] rounded-r-sm ${ROLE_ACCENT[role]}`} />
        <div className="flex flex-1 items-center justify-between gap-3 pl-1">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <Link
                href={`/data/docs/${doc.path}`}
                className="font-mono text-sm font-medium hover:underline"
              >
                {doc.path}
              </Link>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {ROLE_LABELS[role]}
              </span>
              {isTemplate ? (
                <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  template
                </span>
              ) : null}
              {stale ? <StalenessBadge info={stale} /> : null}
            </div>
            <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {subtitle}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
            <span>{timeAgo(doc.updated_at)}</span>
            {words != null ? (
              <span>
                {isTemplate ? "0 words · template" : `${words} word${words === 1 ? "" : "s"}`}
              </span>
            ) : null}
          </div>
        </div>
      </summary>
      {hasContent ? (
        <DocEditor path={doc.path} content={doc.content ?? ""} />
      ) : (
        <div className="border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <Link href={`/data/docs/${doc.path}`} className="font-medium text-foreground/80 hover:text-foreground hover:underline">
            Open to view &amp; edit →
          </Link>
        </div>
      )}
    </details>
  );
}

function StalenessBadge({ info }: { info: StalenessInfo }) {
  if (info.soft) {
    return (
      <span
        className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        title={`Last updated ${info.ageDays}d ago — expected every ${info.expectedDays}d`}
      >
        review? · {info.ageDays}d
      </span>
    );
  }
  return (
    <span
      className="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
      title={`Last updated ${info.ageDays}d ago — expected every ${info.expectedDays}d`}
    >
      stale — {info.ageDays}d ({info.cadenceLabel})
    </span>
  );
}

function FolderSection({
  folder,
  docs,
}: {
  folder: string;
  docs: DocumentRow[];
}) {
  const sorted = [...docs].sort((a, b) => b.path.localeCompare(a.path));
  const description = FOLDER_DESCRIPTIONS[folder];
  const mostRecent = docs.reduce<string | null>(
    (max, d) => (max == null || d.updated_at > max ? d.updated_at : max),
    null,
  );
  return (
    <details className="group rounded-xl border bg-card/60 shadow-sm">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-medium">{folder}/</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {sorted.length} file{sorted.length === 1 ? "" : "s"}
            </span>
          </div>
          {description ? (
            <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {description}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[10px] text-muted-foreground">
          {mostRecent ? <span>{timeAgo(mostRecent)}</span> : null}
          <span className="transition-transform group-open:rotate-90">›</span>
        </div>
      </summary>
      <div className="grid gap-2 px-3 pb-3 pt-1 sm:grid-cols-2">
        {sorted.map((doc) => (
          <DocCard key={doc.path} doc={doc} />
        ))}
      </div>
    </details>
  );
}

function splitByFolder(rows: ReadonlyArray<DocumentRow>): {
  topLevel: DocumentRow[];
  folders: Map<string, DocumentRow[]>;
} {
  const topLevel: DocumentRow[] = [];
  const folders = new Map<string, DocumentRow[]>();
  for (const r of rows) {
    const slash = r.path.indexOf("/");
    if (slash === -1) {
      topLevel.push(r);
      continue;
    }
    const folder = r.path.slice(0, slash);
    const arr = folders.get(folder);
    if (arr) arr.push(r);
    else folders.set(folder, [r]);
  }
  return { topLevel, folders };
}

function sortByRole(rows: DocumentRow[]): DocumentRow[] {
  return [...rows].sort((a, b) => {
    const ra = STANDARD_DOCS[a.path]?.role;
    const rb = STANDARD_DOCS[b.path]?.role;
    const ia = ra ? ROLE_ORDER.indexOf(ra) : ROLE_ORDER.length;
    const ib = rb ? ROLE_ORDER.indexOf(rb) : ROLE_ORDER.length;
    if (ia !== ib) return ia - ib;
    return a.path.localeCompare(b.path);
  });
}

function previewFirstLine(content: string): string {
  const line = content
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find((l) => l.length > 0);
  if (!line) return "(empty)";
  return line.length > 70 ? `${line.slice(0, 70)}…` : line;
}

type StalenessInfo = {
  ageDays: number;
  expectedDays: number;
  /** Human cadence, e.g. "expected weekly" / "expected daily". */
  cadenceLabel: string;
  /** Soft nudge (e.g. GOALS.md): "review?" styling, not amber. */
  soft: boolean;
};

// Flag a doc as stale once it exceeds its cadence plus a 2-day slack window:
// CURRENT.md (7d) flags at >9d, BASELINES.md (1d) flags at >2d. GOALS.md (60d)
// is a soft "review?" nudge rather than an amber alarm.
function staleness(
  updatedAt: string,
  expectedDays: number | undefined,
): StalenessInfo | null {
  if (expectedDays == null) return null;
  const ageDays = Math.floor(
    (Date.now() - new Date(updatedAt).getTime()) / 86_400_000,
  );
  if (ageDays <= expectedDays + 2) return null;
  return {
    ageDays,
    expectedDays,
    cadenceLabel: cadenceLabelFor(expectedDays),
    soft: expectedDays >= 60,
  };
}

function cadenceLabelFor(days: number): string {
  if (days <= 1) return "expected daily";
  if (days <= 7) return "expected weekly";
  if (days <= 14) return "expected biweekly";
  if (days <= 31) return "expected monthly";
  return `expected every ${days}d`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}
