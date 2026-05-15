import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const getMealInputSchema = {
  id: z.string().uuid(),
};

export type GetMealInput = { id: string };

export async function getMeal(userId: string, input: GetMealInput) {
  const sb = adminClient();
  const { data, error } = await sb
    .from("meals")
    .select("*")
    .eq("user_id", userId)
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(`get_meal: ${error.message}`);
  return data;
}
