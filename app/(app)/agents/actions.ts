"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const recipeIdSchema = z.string().trim().min(1).max(100);

async function authedUserId(): Promise<string> {
  const sb = await createClient();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new Error("not authenticated");
  return data.user.id;
}

export async function markRecipeInstalled(recipeId: string) {
  const id = recipeIdSchema.parse(recipeId);
  const userId = await authedUserId();
  const sb = adminClient();
  const nowIso = new Date().toISOString();

  const existing = await sb
    .from("installed_recipes")
    .select("id")
    .eq("user_id", userId)
    .eq("recipe_id", id)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    // Already tracked — nothing to do.
    return { ok: true as const };
  }
  const { error } = await sb.from("installed_recipes").insert({
    user_id: userId,
    recipe_id: id,
    installed_at: nowIso,
    updated_at: nowIso,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/agents");
  return { ok: true as const };
}

export async function markRecipeUninstalled(recipeId: string) {
  const id = recipeIdSchema.parse(recipeId);
  const userId = await authedUserId();
  const sb = adminClient();
  const { error } = await sb
    .from("installed_recipes")
    .delete()
    .eq("user_id", userId)
    .eq("recipe_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/agents");
  return { ok: true as const };
}
