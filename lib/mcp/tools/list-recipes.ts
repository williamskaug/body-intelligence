import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { recipes } from "@/lib/agents/recipe-data";
import { parseRecipeDoc } from "@/lib/agents/recipe-doc";

export const listRecipesInputSchema = {
  include_install_state: z
    .boolean()
    .optional()
    .describe(
      "If true, joins installed_recipes for the caller and adds installed / last_run_at / last_run_status / run_count fields, PLUS the caller's own recipes (catalog:false): docs under recipes/ in the virtual filesystem and any non-catalog recipe ids tracked via mark_recipe_run. Omit for the static recipe catalog only.",
    ),
};

export type ListRecipesInput = {
  include_install_state?: boolean;
};

export async function listRecipes(userId: string, input: ListRecipesInput) {
  if (!input.include_install_state) {
    return { recipes };
  }
  const sb = adminClient();
  const { data, error } = await sb
    .from("installed_recipes")
    .select("recipe_id, installed_at, last_run_at, last_run_status, run_count, last_error")
    .eq("user_id", userId);
  if (error) throw new Error(`list_recipes install state: ${error.message}`);
  const byId = new Map(
    (data ?? []).map((r) => [(r as { recipe_id: string }).recipe_id, r] as const),
  );

  type InstallState = {
    installed_at: string;
    last_run_at: string | null;
    last_run_status: string | null;
    run_count: number;
    last_error: string | null;
  };
  const withState = (id: string, base: Record<string, unknown>) => {
    const state = byId.get(id) as InstallState | undefined;
    return {
      ...base,
      installed: state != null,
      installed_at: state?.installed_at ?? null,
      last_run_at: state?.last_run_at ?? null,
      last_run_status: state?.last_run_status ?? null,
      run_count: state?.run_count ?? 0,
      last_error: state?.last_error ?? null,
    };
  };

  // The caller's own recipes: docs under recipes/ plus tracked non-catalog ids.
  const { data: docs, error: docsError } = await sb
    .from("documents")
    .select("path, content")
    .eq("user_id", userId)
    .like("path", "recipes/%")
    .order("path");
  if (docsError) throw new Error(`list_recipes user docs: ${docsError.message}`);

  const catalogIds = new Set(recipes.map((r) => r.id));
  const userRecipes: Array<Record<string, unknown>> = [];
  const userSlugs = new Set<string>();
  for (const row of (docs ?? []) as Array<{ path: string; content: string }>) {
    const doc = parseRecipeDoc(row.path, row.content);
    if (!doc) continue;
    userSlugs.add(doc.slug);
    userRecipes.push(
      withState(doc.slug, {
        id: doc.slug,
        title: doc.title,
        catalog: false,
        path: doc.path,
        schedule: doc.schedule,
        covers: doc.covers,
        description: doc.description,
      }),
    );
  }
  for (const recipeId of byId.keys()) {
    if (catalogIds.has(recipeId) || userSlugs.has(recipeId)) continue;
    userRecipes.push(withState(recipeId, { id: recipeId, catalog: false }));
  }

  return {
    recipes: recipes.map((r) => withState(r.id, { ...r, catalog: true })),
    user_recipes: userRecipes,
  };
}
