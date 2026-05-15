import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { logMealInputSchema } from "./log-meal";

const MAX_BATCH = 500;
const itemSchema = z.object(logMealInputSchema);

export const bulkLogMealsInputSchema = {
  items: z.array(itemSchema).min(1).max(MAX_BATCH),
  on_conflict: z.enum(["ignore", "update"]).default("update"),
};

export type BulkLogMealsInput = {
  items: z.infer<typeof itemSchema>[];
  on_conflict?: "ignore" | "update";
};

export async function bulkLogMeals(userId: string, input: BulkLogMealsInput) {
  const sb = adminClient();
  const onConflict = input.on_conflict ?? "update";
  const nowIso = new Date().toISOString();
  const errors: Array<{ index: number; error: string }> = [];
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i]!;
    const payload = {
      user_id: userId,
      eaten_at: it.eaten_at,
      meal_type: it.meal_type ?? null,
      description: it.description,
      calories: it.calories,
      protein_g: it.protein_g,
      carbs_g: it.carbs_g,
      fat_g: it.fat_g,
      fiber_g: it.fiber_g ?? null,
      notes: it.notes ?? null,
      source: it.source ?? "manual",
      source_id: it.source_id ?? null,
      updated_at: nowIso,
    };

    if (it.source_id) {
      const existing = await sb
        .from("meals")
        .select("id")
        .eq("user_id", userId)
        .eq("source", payload.source)
        .eq("source_id", it.source_id)
        .maybeSingle();
      if (existing.error) {
        errors.push({ index: i, error: existing.error.message });
        continue;
      }
      if (existing.data) {
        if (onConflict === "ignore") continue;
        const { error: upErr } = await sb
          .from("meals")
          .update(payload)
          .eq("id", existing.data.id);
        if (upErr) errors.push({ index: i, error: upErr.message });
        else updated++;
        continue;
      }
    }

    const { error } = await sb.from("meals").insert(payload);
    if (error) errors.push({ index: i, error: error.message });
    else inserted++;
  }
  return { inserted, updated, errors };
}
