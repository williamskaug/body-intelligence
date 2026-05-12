import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { isoTimestamp } from "./shared";

// Calories and macros are REQUIRED. If the caller doesn't have authoritative
// values (label, connector, weighed portion) it must estimate from the
// description before writing. The schema enforces presence; estimation quality
// is the caller's responsibility. See the tool description in lib/mcp/server.ts.
export const logMealInputSchema = {
  eaten_at: isoTimestamp,
  meal_type: z.string().trim().max(50).optional(),
  description: z.string().trim().min(1).max(2000),
  calories: z
    .number()
    .int()
    .min(0)
    .max(20_000)
    .describe(
      "kcal for the meal. REQUIRED — if not known, estimate from the description.",
    ),
  protein_g: z
    .number()
    .min(0)
    .max(2000)
    .describe("grams of protein. REQUIRED — estimate if not known."),
  carbs_g: z
    .number()
    .min(0)
    .max(2000)
    .describe("grams of carbohydrate. REQUIRED — estimate if not known."),
  fat_g: z
    .number()
    .min(0)
    .max(2000)
    .describe("grams of fat. REQUIRED — estimate if not known."),
  fiber_g: z.number().min(0).max(500).optional(),
  notes: z.string().max(10_000).optional(),
  source: z.string().trim().max(50).default("manual"),
  source_id: z.string().trim().max(200).optional(),
};

export type LogMealInput = {
  eaten_at: string;
  meal_type?: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  notes?: string;
  source?: string;
  source_id?: string;
};

export async function logMeal(userId: string, input: LogMealInput) {
  const sb = adminClient();
  const source = input.source ?? "manual";

  const payload = {
    user_id: userId,
    eaten_at: input.eaten_at,
    meal_type: input.meal_type ?? null,
    description: input.description,
    calories: input.calories,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    fiber_g: input.fiber_g ?? null,
    notes: input.notes ?? null,
    source,
    source_id: input.source_id ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.source_id) {
    const existing = await sb
      .from("meals")
      .select("id")
      .eq("user_id", userId)
      .eq("source", source)
      .eq("source_id", input.source_id)
      .maybeSingle();
    if (existing.error) throw new Error(`log_meal lookup: ${existing.error.message}`);
    if (existing.data) {
      const { data, error } = await sb
        .from("meals")
        .update(payload)
        .eq("id", existing.data.id)
        .select()
        .single();
      if (error) throw new Error(`log_meal update: ${error.message}`);
      return { row: data, action: "updated" as const };
    }
  }

  const { data, error } = await sb.from("meals").insert(payload).select().single();
  if (error) throw new Error(`log_meal insert: ${error.message}`);
  return { row: data, action: "inserted" as const };
}
