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
    <li className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{recipe.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{scheduleLabel}</p>
        </div>
        <Badge variant="secondary">{categoryLabels[recipe.category]}</Badge>
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

      <div className="mt-5 flex justify-end">
        <InstallRecipeButton recipe={recipe} />
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
