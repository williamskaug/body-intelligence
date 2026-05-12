import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const deleteMealInputSchema = {
  id: z.string().uuid(),
};

export type DeleteMealInput = { id: string };

export async function deleteMeal(userId: string, input: DeleteMealInput) {
  const sb = adminClient();
  const { data, error } = await sb
    .from("meals")
    .delete()
    .eq("id", input.id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`delete_meal: ${error.message}`);
  if (!data) throw new Error(`delete_meal: meal ${input.id} not found`);
  return { id: data.id, deleted: true as const };
}
