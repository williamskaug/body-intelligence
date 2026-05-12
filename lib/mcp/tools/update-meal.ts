import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { isoTimestamp } from "./shared";

// Note: the macro fields are nullable here (unlike log_meal where they are
// required). Update is for *correcting* an existing row — if the caller knows
// they want to clear a stale macro estimate, allowing null is intentional.
// New rows must come in through log_meal with full energy + macros.
export const updateMealInputSchema = {
  id: z.string().uuid(),
  eaten_at: isoTimestamp.optional(),
  meal_type: z.string().trim().max(50).nullable().optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  calories: z.number().int().min(0).max(20_000).nullable().optional(),
  protein_g: z.number().min(0).max(2000).nullable().optional(),
  carbs_g: z.number().min(0).max(2000).nullable().optional(),
  fat_g: z.number().min(0).max(2000).nullable().optional(),
  fiber_g: z.number().min(0).max(500).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
};

export type UpdateMealInput = {
  id: string;
  eaten_at?: string;
  meal_type?: string | null;
  description?: string;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  notes?: string | null;
};

const UPDATABLE_KEYS = [
  "eaten_at",
  "meal_type",
  "description",
  "calories",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fiber_g",
  "notes",
] as const;

export async function updateMeal(userId: string, input: UpdateMealInput) {
  const sb = adminClient();

  const partial: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of UPDATABLE_KEYS) {
    if (input[key] !== undefined) partial[key] = input[key];
  }

  const { data, error } = await sb
    .from("meals")
    .update(partial)
    .eq("id", input.id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw new Error(`update_meal: ${error.message}`);
  if (!data) throw new Error(`update_meal: meal ${input.id} not found`);
  return data;
}
