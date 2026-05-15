import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const markRecipeRunInputSchema = {
  recipe_id: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("The recipe id from lib/agents/recipe-data.ts (e.g. 'morning-checkin')."),
  status: z
    .enum(["ok", "failed"])
    .describe("Mark this run successful or failed."),
  error: z
    .string()
    .max(2000)
    .optional()
    .describe("When status='failed', a short error description for the UI."),
};

export type MarkRecipeRunInput = {
  recipe_id: string;
  status: "ok" | "failed";
  error?: string;
};

export async function markRecipeRun(userId: string, input: MarkRecipeRunInput) {
  const sb = adminClient();
  const nowIso = new Date().toISOString();

  const existing = await sb
    .from("installed_recipes")
    .select("id, run_count")
    .eq("user_id", userId)
    .eq("recipe_id", input.recipe_id)
    .maybeSingle();
  if (existing.error) throw new Error(`mark_recipe_run lookup: ${existing.error.message}`);

  if (existing.data) {
    const { data, error } = await sb
      .from("installed_recipes")
      .update({
        last_run_at: nowIso,
        last_run_status: input.status,
        run_count: (existing.data.run_count ?? 0) + 1,
        last_error: input.status === "failed" ? (input.error ?? null) : null,
        updated_at: nowIso,
      })
      .eq("id", existing.data.id)
      .select()
      .single();
    if (error) throw new Error(`mark_recipe_run update: ${error.message}`);
    return data;
  }

  // Auto-install on first reported run so users who installed in Cowork
  // before this feature existed get their state recorded the first time
  // the recipe writes back.
  const { data, error } = await sb
    .from("installed_recipes")
    .insert({
      user_id: userId,
      recipe_id: input.recipe_id,
      installed_at: nowIso,
      last_run_at: nowIso,
      last_run_status: input.status,
      run_count: 1,
      last_error: input.status === "failed" ? (input.error ?? null) : null,
      updated_at: nowIso,
    })
    .select()
    .single();
  if (error) throw new Error(`mark_recipe_run insert: ${error.message}`);
  return data;
}
