import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { recipes, type Recipe, type RecipeCategory } from "@/lib/agents/recipe-data";
import { InstallRecipeButton } from "./install-button";

const categoryLabels: Record<RecipeCategory, string> = {
  capture: "Capture",
  review: "Review",
  planning: "Planning",
  connector: "Connector",
};

const categoryAccent: Record<RecipeCategory, string> = {
  capture: "bg-emerald-500/70",
  review: "bg-sky-500/70",
  planning: "bg-violet-500/70",
  connector: "bg-amber-500/70",
};

const categoryBadge: Record<RecipeCategory, string> = {
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

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const { category: raw } = await searchParams;
  const filter = isCategory(raw) ? raw : null;

  const filtered = filter ? recipes.filter((r) => r.category === filter) : recipes;
  const categoryCounts = recipes.reduce<Record<RecipeCategory, number>>(
    (acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    },
    { capture: 0, review: 0, planning: 0, connector: 0 },
  );

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Recipe library</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Each recipe is a prompt plus a schedule. Open one, copy the prompt and
          cron, then paste them into Cowork&apos;s new-scheduled-task dialog.
          Body Intelligence never runs these — your Claude does, against the
          MCP tools you authorized.
        </p>
      </header>

      <nav
        aria-label="Filter by category"
        className="mt-8 flex flex-wrap items-center gap-1.5 text-sm"
      >
        <FilterChip href="/agents" label="All" count={recipes.length} active={!filter} />
        {(["capture", "review", "planning", "connector"] as const)
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
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </ul>
      )}
    </div>
  );
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

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const scheduleLabel =
    recipe.id === "onboarding"
      ? "On demand"
      : humanizeCron(recipe.schedule) ?? recipe.schedule;
  const needsConnectors = recipe.required_connectors.length > 0;
  return (
    <li className="group relative flex overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-foreground/20">
      <span
        aria-hidden
        className={`w-1 shrink-0 ${categoryAccent[recipe.category]}`}
      />
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{recipe.title}</h2>
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

        <div className="mt-auto flex justify-end pt-5">
          <InstallRecipeButton recipe={recipe} />
        </div>
      </div>
    </li>
  );
}

function isCategory(v: string | undefined): v is RecipeCategory {
  return v === "capture" || v === "review" || v === "planning" || v === "connector";
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
