import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const getRecipeStatusInputSchema = {
  recipe_id: z.string().trim().min(1).max(100),
};

export type GetRecipeStatusInput = { recipe_id: string };

export async function getRecipeStatus(userId: string, input: GetRecipeStatusInput) {
  const sb = adminClient();
  const { data, error } = await sb
    .from("installed_recipes")
    .select("installed_at, last_run_at, last_run_status, run_count, last_error")
    .eq("user_id", userId)
    .eq("recipe_id", input.recipe_id)
    .maybeSingle();
  if (error) throw new Error(`get_recipe_status: ${error.message}`);
  if (!data) {
    return { installed: false as const };
  }
  return {
    installed: true as const,
    ...(data as {
      installed_at: string;
      last_run_at: string | null;
      last_run_status: string | null;
      run_count: number;
      last_error: string | null;
    }),
  };
}
