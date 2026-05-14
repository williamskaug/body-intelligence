import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { recipes } from "@/lib/agents/recipe-data";

export const listRecipesInputSchema = {
  include_install_state: z
    .boolean()
    .optional()
    .describe(
      "If true, joins installed_recipes for the caller and adds installed / last_run_at / last_run_status / run_count fields. Omit for the static recipe catalog only.",
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
  return {
    recipes: recipes.map((r) => {
      const state = byId.get(r.id) as
        | {
            installed_at: string;
            last_run_at: string | null;
            last_run_status: string | null;
            run_count: number;
            last_error: string | null;
          }
        | undefined;
      return {
        ...r,
        installed: state != null,
        installed_at: state?.installed_at ?? null,
        last_run_at: state?.last_run_at ?? null,
        last_run_status: state?.last_run_status ?? null,
        run_count: state?.run_count ?? 0,
        last_error: state?.last_error ?? null,
      };
    }),
  };
}
