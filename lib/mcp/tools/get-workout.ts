import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { getWorkoutMetrics } from "./workout-metrics";
import { getWorkoutZones } from "./workout-zones";

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
  if (!data) return null;
  const metrics = await getWorkoutMetrics(sb, userId, data.id);
  const zones = await getWorkoutZones(sb, userId, data.id);
  return { ...data, metrics, zones };
}
