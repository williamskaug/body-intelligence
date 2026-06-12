import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { recipes, type Recipe, type RecipeCategory } from "@/lib/agents/recipe-data";
import { parseRecipeDoc, type UserRecipeDoc } from "@/lib/agents/recipe-doc";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { InstallRecipeButton } from "./install-button";
import { RecipeInstalledControls } from "./installed-controls";

const categoryLabels: Record<RecipeCategory, string> = {
  autopilot: "Autopilot",
  capture: "Capture",
  review: "Review",
  planning: "Planning",
  connector: "Connector",
};

const categoryAccent: Record<RecipeCategory, string> = {
  autopilot: "bg-rose-500/70",
  capture: "bg-emerald-500/70",
  review: "bg-sky-500/70",
  planning: "bg-violet-500/70",
  connector: "bg-amber-500/70",
};

const categoryBadge: Record<RecipeCategory, string> = {
  autopilot:
    "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  capture:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  review:
    "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  planning:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  connector:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

function CategoryIcon({ category }: { category: RecipeCategory }) {
  const common = "h-3 w-3";
  switch (category) {
    case "autopilot":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path d="M8 2v3M8 11v3M2 8h3M11 8h3" strokeLinecap="round" />
          <circle cx="8" cy="8" r="2.25" />
        </svg>
      );
    case "capture":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path d="M8 3v10M3 8h10" strokeLinecap="round" />
        </svg>
      );
    case "review":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path d="M3 12l3-3 3 3 4-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "planning":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <circle cx="8" cy="8" r="5" />
          <path d="M8 5v3l2 1.5" strokeLinecap="round" />
        </svg>
      );
    case "connector":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path d="M5 8.5l2-2.5 4 4.5M9 5.5l2-2.5M5 13l2-2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

type Params = Promise<{ category?: string }>;

type InstallState = {
  installed_at: string;
  last_run_at: string | null;
  last_run_status: string | null;
  run_count: number;
  last_error: string | null;
};

type UserAgent = {
  slug: string;
  doc: UserRecipeDoc | null;
  state: InstallState | undefined;
};

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const { category: raw } = await searchParams;
  const filter = isCategory(raw) ? raw : null;
  const [installState, userDocs] = await Promise.all([
    loadInstallState(),
    loadUserRecipeDocs(),
  ]);

  // "Your agents": user-authored recipe docs under recipes/, merged with
  // run state, plus any tracked non-catalog recipe ids without a doc.
  const catalogIds = new Set(recipes.map((r) => r.id));
  const userAgents: UserAgent[] = userDocs.map((doc) => ({
    slug: doc.slug,
    doc,
    state: installState.get(doc.slug),
  }));
  for (const [recipeId, state] of installState) {
    if (catalogIds.has(recipeId)) continue;
    if (userAgents.some((a) => a.slug === recipeId)) continue;
    userAgents.push({ slug: recipeId, doc: null, state });
  }
  userAgents.sort((a, b) => (b.state?.run_count ?? 0) - (a.state?.run_count ?? 0));

  // Supersession: a catalog recipe is "covered" when an actively-running
  // user recipe's covers tags include all of the catalog recipe's tags.
  // Pure tag intersection — declared by the user in front-matter.
  const coveredBy = (recipe: Recipe): string | null => {
    if (recipe.covers.length === 0) return null;
    for (const agent of userAgents) {
      if (!agent.doc || !agent.state) continue;
      const tags = new Set(agent.doc.covers);
      if (tags.size > 0 && recipe.covers.every((t) => tags.has(t))) {
        return agent.doc.title;
      }
    }
    return null;
  };

  const filtered = filter ? recipes.filter((r) => r.category === filter) : recipes;
  const categoryCounts = recipes.reduce<Record<RecipeCategory, number>>(
    (acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    },
    { autopilot: 0, capture: 0, review: 0, planning: 0, connector: 0 },
  );

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Agents</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Each recipe is a prompt plus a schedule. Open one, copy the prompt and
          cron, then paste them into Cowork&apos;s new-scheduled-task dialog.
          Body Intelligence never runs these — your Claude does, against the
          MCP tools you authorized.
        </p>
      </header>

      {userAgents.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Your agents</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Recipes you authored (stored under <code className="font-mono">recipes/</code> in
            your memory files) and scheduled agents reporting in via{" "}
            <code className="font-mono">mark_recipe_run</code>.
          </p>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {userAgents.map((agent) => (
              <UserAgentCard key={agent.slug} agent={agent} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Recipe library</h2>

        <nav
          aria-label="Filter by category"
          className="mt-4 flex flex-wrap items-center gap-1.5 text-sm"
        >
          <FilterChip href="/agents" label="All" count={recipes.length} active={!filter} />
          {(["autopilot", "capture", "review", "planning", "connector"] as const)
            .filter((c) => categoryCounts[c] > 0)
            .map((c) => (
              <FilterChip
                key={c}
                href={`/agents?category=${c}`}
                label={categoryLabels[c]}
                count={categoryCounts[c]}
                active={filter === c}
              />
            ))}
        </nav>

        {filtered.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No recipes in this category yet.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {filtered.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                state={installState.get(recipe.id)}
                coveredByTitle={coveredBy(recipe)}
                customizedDoc={
                  userAgents.find((a) => a.slug === recipe.id)?.doc ?? null
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function UserAgentCard({ agent }: { agent: UserAgent }) {
  const { doc, state } = agent;
  const title = doc?.title ?? agent.slug;
  const failed = state?.last_run_status === "failed";
  const scheduleLabel = doc?.schedule
    ? humanizeCron(doc.schedule) ?? doc.schedule
    : null;
  return (
    <li className="group relative flex overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-foreground/20">
      <span aria-hidden className="w-1 shrink-0 bg-rose-500/70" />
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="text-base font-semibold tracking-tight">{title}</h3>
              {failed ? (
                <span className="rounded-md border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
                  last run failed
                </span>
              ) : state ? (
                <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                  active
                </span>
              ) : null}
            </div>
            {scheduleLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">{scheduleLabel}</p>
            ) : null}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
            Yours
          </span>
        </div>
        {doc?.description ? (
          <p className="mt-3 text-sm text-muted-foreground">{doc.description}</p>
        ) : null}
        {state ? (
          <div className="mt-3 rounded-md border bg-muted/20 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">
              {state.run_count} run{state.run_count === 1 ? "" : "s"}
            </span>
            {state.last_run_at ? (
              <> · last {timeAgo(state.last_run_at)} ({state.last_run_status ?? "?"})</>
            ) : (
              <> · awaiting first run</>
            )}
            {state.last_error ? (
              <span className="mt-1 block text-rose-700 dark:text-rose-400">
                Error: {state.last_error}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            No tracked runs — invoked by another agent, or not scheduled yet.
          </p>
        )}
        {doc ? (
          <div className="mt-auto pt-4">
            <Link
              href={`/data/docs/${doc.path}`}
              className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
            >
              View recipe →
            </Link>
          </div>
        ) : null}
      </div>
    </li>
  );
}

async function loadUserRecipeDocs(): Promise<UserRecipeDoc[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const sb = adminClient();
  const { data, error } = await sb
    .from("documents")
    .select("path, content")
    .eq("user_id", user.id)
    .like("path", "recipes/%")
    .order("path");
  if (error) return [];
  const out: UserRecipeDoc[] = [];
  for (const row of (data ?? []) as Array<{ path: string; content: string }>) {
    const doc = parseRecipeDoc(row.path, row.content);
    if (doc) out.push(doc);
  }
  return out;
}

async function loadInstallState(): Promise<Map<string, InstallState>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Map();
  const sb = adminClient();
  const { data, error } = await sb
    .from("installed_recipes")
    .select("recipe_id, installed_at, last_run_at, last_run_status, run_count, last_error")
    .eq("user_id", user.id);
  if (error) return new Map();
  const out = new Map<string, InstallState>();
  for (const row of (data ?? []) as Array<{ recipe_id: string } & InstallState>) {
    out.set(row.recipe_id, row);
  }
  return out;
}

function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
      <span
        className={`tabular-nums ${active ? "opacity-80" : "opacity-60"}`}
      >
        {count}
      </span>
    </Link>
  );
}

function RecipeCard({
  recipe,
  state,
  coveredByTitle,
  customizedDoc,
}: {
  recipe: Recipe;
  state: InstallState | undefined;
  coveredByTitle: string | null;
  customizedDoc: UserRecipeDoc | null;
}) {
  const scheduleLabel =
    recipe.id === "onboarding"
      ? "On demand"
      : humanizeCron(recipe.schedule) ?? recipe.schedule;
  const needsConnectors = recipe.required_connectors.length > 0;
  const installed = state != null;
  const failed = state?.last_run_status === "failed";
  return (
    <li className="group relative flex overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-foreground/20">
      <span
        aria-hidden
        className={`w-1 shrink-0 ${categoryAccent[recipe.category]}`}
      />
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-semibold tracking-tight">{recipe.title}</h2>
              <InstallStatePill
                installed={installed}
                failed={failed}
                coveredByTitle={coveredByTitle}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{scheduleLabel}</p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryBadge[recipe.category]}`}
          >
            <CategoryIcon category={recipe.category} />
            {categoryLabels[recipe.category]}
          </span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{recipe.description}</p>

        {customizedDoc && state != null ? (
          <p className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-900 dark:text-rose-200">
            You run a customized version —{" "}
            <Link
              href={`/data/docs/${customizedDoc.path}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              view your recipe
            </Link>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
          {recipe.required_tools.map((tool) => (
            <Badge key={tool} variant="outline" className="font-mono">
              {tool}
            </Badge>
          ))}
        </div>

        {needsConnectors ? (
          <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-900 dark:text-amber-200">
            Requires {recipe.required_connectors.join(", ")} connector in Cowork
          </p>
        ) : null}

        {state ? (
          <div className="mt-3 rounded-md border bg-muted/20 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">
              {state.run_count} run{state.run_count === 1 ? "" : "s"}
            </span>
            {state.last_run_at ? (
              <> · last {timeAgo(state.last_run_at)} ({state.last_run_status ?? "?"})</>
            ) : (
              <> · awaiting first run</>
            )}
            {state.last_error ? (
              <span className="mt-1 block text-rose-700 dark:text-rose-400">
                Error: {state.last_error}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-5">
          <RecipeInstalledControls recipeId={recipe.id} installed={installed} />
          <InstallRecipeButton recipe={recipe} />
        </div>
      </div>
    </li>
  );
}

function InstallStatePill({
  installed,
  failed,
  coveredByTitle,
}: {
  installed: boolean;
  failed: boolean;
  coveredByTitle: string | null;
}) {
  if (!installed) {
    if (coveredByTitle) {
      return (
        <span className="rounded-md border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
          covered by your {coveredByTitle}
        </span>
      );
    }
    return (
      <span className="rounded-md border border-foreground/20 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        not installed
      </span>
    );
  }
  if (failed) {
    return (
      <span className="rounded-md border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
        last run failed
      </span>
    );
  }
  return (
    <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
      installed
    </span>
  );
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

function isCategory(v: string | undefined): v is RecipeCategory {
  return (
    v === "autopilot" ||
    v === "capture" ||
    v === "review" ||
    v === "planning" ||
    v === "connector"
  );
}

// Lightweight pretty-printer for the cron strings we actually ship.
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
function humanizeCron(expr: string): string | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, mon, dow] = parts;
  const time =
    /^\d+$/.test(hour) && /^\d+$/.test(min)
      ? `${pad(hour)}:${pad(min)}`
      : null;
  if (mon === "*" && dom === "*") {
    if (dow === "*") return time ? `Daily at ${time}` : "Daily";
    if (/^\d$/.test(dow))
      return time
        ? `Weekly on ${DAYS[Number(dow)]} at ${time}`
        : `Weekly on ${DAYS[Number(dow)]}`;
    if (/^\d+\/\d+$/.test(dow)) {
      const [start, step] = dow.split("/").map(Number);
      return time
        ? `Every ${step} days from ${DAYS[start]} at ${time}`
        : `Every ${step} days from ${DAYS[start]}`;
    }
  }
  return null;
}
function pad(s: string): string {
  return s.length === 1 ? `0${s}` : s;
}
