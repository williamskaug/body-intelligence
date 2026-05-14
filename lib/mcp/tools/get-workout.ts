import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const getWorkoutInputSchema = {
  id: z.string().uuid(),
};

export type GetWorkoutInput = { id: string };

export async function getWorkout(userId: string, input: GetWorkoutInput) {
  const sb = adminClient();
  const { data, error } = await sb
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(`get_workout: ${error.message}`);
  return data;
}
