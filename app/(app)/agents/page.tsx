import { Badge } from "@/components/ui/badge";
import { recipes, type Recipe, type RecipeCategory } from "@/lib/agents/recipe-data";
import { InstallRecipeButton } from "./install-button";

const categoryLabels: Record<RecipeCategory, string> = {
  capture: "Capture",
  review: "Review",
  planning: "Planning",
  connector: "Connector",
};

export default function AgentsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Recipe library</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Each recipe is a prompt plus a schedule. Click <em>Install</em> to copy
          the prompt into Cowork&apos;s new-scheduled-task dialog. Body
          Intelligence never runs these — your Claude does, against the MCP
          tools you authorized.
        </p>
      </div>

      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </ul>
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <li className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{recipe.title}</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {recipe.schedule}
          </p>
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
        {recipe.required_connectors.map((connector) => (
          <Badge key={connector}>requires {connector}</Badge>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <InstallRecipeButton recipe={recipe} />
      </div>
    </li>
  );
}
