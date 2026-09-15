import Link from "next/link";
import { recipes, type Recipe, type RecipeCategory } from "@/lib/agents/recipe-data";
import type { UserRecipeDoc } from "@/lib/agents/recipe-doc";
import { InstallRecipeButton } from "@/app/(app)/agents/install-button";
import { RecipeInstalledControls } from "@/app/(app)/agents/installed-controls";
import { cn } from "@/lib/utils";

export type InstallState = {
  installed_at: string;
  last_run_at: string | null;
  last_run_status: string | null;
  run_count: number;
  last_error: string | null;
};

export type CaptureGap = {
  weightDaysAgo: number | null;
  notesDays: number;
  missing: string[];
};

const categoryLabels: Record<RecipeCategory, string> = {
  autopilot: "Autopilot",
  capture: "Capture",
  review: "Review",
  planning: "Planning",
  connector: "Connector",
};

type YourAgent = {
  id: string;
  title: string;
  schedule: string | null;
  covers: string[];
  state: InstallState | undefined;
  path: string | null;
};

export function AgentsView({
  installState,
  userDocs,
  capture,
}: {
  installState: Map<string, InstallState>;
  userDocs: UserRecipeDoc[];
  capture: CaptureGap;
}) {
  const docsBySlug = new Map(userDocs.map((d) => [d.slug, d]));

  const coveredBy = (recipe: Recipe): string | null => {
    if (recipe.covers.length === 0) return null;
    for (const doc of userDocs) {
      const state = installState.get(doc.slug);
      if (!state) continue;
      const tags = new Set(doc.covers);
      if (tags.size > 0 && recipe.covers.every((t) => tags.has(t))) return doc.title;
    }
    return null;
  };

  const yourAgents: YourAgent[] = [];
  const seen = new Set<string>();
  for (const [id, state] of installState) {
    const catalog = recipes.find((r) => r.id === id);
    const doc = docsBySlug.get(id);
    yourAgents.push({
      id,
      title: doc?.title ?? catalog?.title ?? id,
      schedule: doc?.schedule ?? catalog?.schedule ?? null,
      covers: doc?.covers.length ? doc.covers : catalog?.covers ?? [],
      state,
      path: doc?.path ?? (catalog ? `recipes/${catalog.id}.md` : null),
    });
    seen.add(id);
  }
  for (const doc of userDocs) {
    if (seen.has(doc.slug)) continue;
    yourAgents.push({
      id: doc.slug,
      title: doc.title,
      schedule: doc.schedule,
      covers: doc.covers,
      state: undefined,
      path: doc.path,
    });
  }
  yourAgents.sort((a, b) => (b.state?.run_count ?? 0) - (a.state?.run_count ?? 0));

  return (
    <div className="bg-white">
      {(capture.weightDaysAgo != null && capture.weightDaysAgo > 14) ||
      capture.notesDays < 10 ||
      capture.missing.length > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[12px]">
          <p>
            <span className="mr-2 border border-amber-300 px-1.5 py-px text-[10px] uppercase tracking-wide text-amber-800">
              Capture gap
            </span>
            {capture.weightDaysAgo != null
              ? `Weight last logged ${capture.weightDaysAgo} d ago`
              : "No weight logged"}
            {` · notes ${capture.notesDays} of last 14 days`}
            {capture.missing.length > 0 ? ` · missing ${capture.missing.join(", ")}` : ""}
            {" — the dawn agent doesn't cover these."}
          </p>
          <Link href="/memory?path=HEALTH_LOG.md" className="text-[10px] uppercase tracking-wide text-neutral-500">
            Log →
          </Link>
        </div>
      ) : null}

      <section className="px-3 py-3">
        <h2 className="text-[13px] font-semibold">Your agents</h2>
        <table className="mt-2 w-full text-left text-[12px]">
          <thead className="text-[10px] uppercase tracking-wide text-neutral-400">
            <tr>
              {["Recipe", "Schedule", "Last run", "Status", "Runs", "Covers", ""].map((h) => (
                <th key={h} className="py-1 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yourAgents.map((a) => {
              const failed = a.state?.last_run_status === "failed";
              const stale = !failed && isStale(a.state?.last_run_at);
              return (
                <tr key={a.id} className="border-t border-neutral-100">
                  <td className="py-1.5 font-mono">{a.id}</td>
                  <td className="py-1.5 text-neutral-600">
                    {a.schedule ? humanizeCron(a.schedule) ?? a.schedule : "—"}
                  </td>
                  <td className="py-1.5 font-mono">
                    {a.state?.last_run_at ? timeAgo(a.state.last_run_at) : "—"}
                  </td>
                  <td className="py-1.5">
                    <span
                      className={cn(
                        "font-mono text-[10px] uppercase",
                        failed ? "text-rose-600" : stale ? "text-amber-700" : "text-emerald-700",
                      )}
                    >
                      {failed ? "failed" : stale ? `stale ${staleLabel(a.state?.last_run_at)}` : a.state ? "ok" : "—"}
                    </span>
                  </td>
                  <td className="py-1.5 font-mono">{a.state?.run_count ?? 0}</td>
                  <td className="py-1.5 text-neutral-500">
                    {a.covers.map(shortCover).join(" · ") || "—"}
                  </td>
                  <td className="py-1.5 text-right">
                    {a.path ? (
                      <Link
                        href={`/memory?path=${encodeURIComponent(a.path.startsWith("recipes/") ? a.path : a.path)}`}
                        className="text-[10px] uppercase tracking-wide text-neutral-500 hover:text-foreground"
                      >
                        Open
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {yourAgents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-neutral-400">
                  No tracked agents yet. Install a recipe from the library below.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section id="recipe-library" className="border-t border-neutral-200 px-3 py-4">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
          Recipe library
          <span
            title="Catalog prompts you copy into Cowork. Coverage is tag intersection with your recipes/, not a recommendation."
            className="inline-flex size-3.5 cursor-help items-center justify-center rounded-full border border-neutral-300 text-[9px] text-neutral-400"
          >
            ?
          </span>
        </h2>
        <ul className="mt-3 grid gap-px bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => {
            const state = installState.get(recipe.id);
            const covered = coveredBy(recipe);
            const customized = docsBySlug.get(recipe.id) ?? null;
            return (
              <li key={recipe.id} className="bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[13px] font-semibold">{recipe.title}</h3>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-neutral-400">
                      {categoryLabels[recipe.category]} ·{" "}
                      {recipe.id === "onboarding"
                        ? "once"
                        : humanizeCron(recipe.schedule)?.replace(/^Weekly on /, "") ?? recipe.schedule}
                    </p>
                  </div>
                  <StatusPill installed={state != null} failed={state?.last_run_status === "failed"} coveredByTitle={covered} ranAt={state?.last_run_at} />
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-neutral-600">{recipe.description}</p>
                {customized && state ? (
                  <p className="mt-2 text-[11px]">
                    Customized —{" "}
                    <Link href={`/memory?path=${encodeURIComponent(customized.path)}`} className="underline">
                      view your recipe
                    </Link>
                  </p>
                ) : null}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <RecipeInstalledControls recipeId={recipe.id} installed={state != null} />
                  <InstallRecipeButton recipe={recipe} compact />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function StatusPill({
  installed,
  failed,
  coveredByTitle,
  ranAt,
}: {
  installed: boolean;
  failed: boolean;
  coveredByTitle: string | null;
  ranAt: string | null | undefined;
}) {
  if (!installed && coveredByTitle) {
    return (
      <span className="shrink-0 border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-800">
        covered by {coveredByTitle}
      </span>
    );
  }
  if (!installed) {
    return (
      <span className="shrink-0 border border-neutral-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
        not installed
      </span>
    );
  }
  if (failed) {
    return (
      <span className="shrink-0 border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-rose-800">
        failed
      </span>
    );
  }
  return (
    <span className="shrink-0 border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-800">
      {ranAt ? `ran ${ranAt.slice(0, 10)}` : "installed"}
    </span>
  );
}

function shortCover(tag: string): string {
  const parts = tag.split(":");
  return parts[1] ?? tag;
}

function isStale(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() > 2 * 86_400_000;
}

function staleLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return `${d}d`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `today ${new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  const day = Math.floor(hr / 24);
  if (day < 30) return iso.slice(0, 10);
  return iso.slice(0, 10);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
function humanizeCron(expr: string): string | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, mon, dow] = parts;
  const time = /^\d+$/.test(hour) && /^\d+$/.test(min) ? `${pad(hour)}:${pad(min)}` : null;
  if (mon === "*" && dom === "*") {
    if (dow === "*") return time ? `daily ${time}` : "daily";
    if (/^\d$/.test(dow))
      return time ? `${DAYS[Number(dow)]} ${time}` : `${DAYS[Number(dow)]}`;
  }
  return null;
}
function pad(s: string): string {
  return s.length === 1 ? `0${s}` : s;
}
