import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const deleteWorkoutInputSchema = {
  id: z.string().uuid(),
};

export type DeleteWorkoutInput = { id: string };

export async function deleteWorkout(userId: string, input: DeleteWorkoutInput) {
  const sb = adminClient();
  const { data, error } = await sb
    .from("workouts")
    .delete()
    .eq("id", input.id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`delete_workout: ${error.message}`);
  if (!data) throw new Error(`delete_workout: workout ${input.id} not found`);
  return { id: data.id, deleted: true as const };
}
