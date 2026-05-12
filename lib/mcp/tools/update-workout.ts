import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";

export const updateWorkoutInputSchema = {
  id: z.string().uuid(),
  date: dateString.optional(),
  type: z.string().trim().min(1).max(200).optional(),
  duration_min: z.number().int().min(0).max(60 * 24).nullable().optional(),
  distance_km: z.number().min(0).max(10_000).nullable().optional(),
  avg_hr: z.number().int().min(20).max(260).nullable().optional(),
  max_hr: z.number().int().min(20).max(260).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  shoes: z.string().trim().max(100).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
};

export type UpdateWorkoutInput = {
  id: string;
  date?: string;
  type?: string;
  duration_min?: number | null;
  distance_km?: number | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  rpe?: number | null;
  shoes?: string | null;
  notes?: string | null;
};

const UPDATABLE_KEYS = [
  "date",
  "type",
  "duration_min",
  "distance_km",
  "avg_hr",
  "max_hr",
  "rpe",
  "shoes",
  "notes",
] as const;

export async function updateWorkout(userId: string, input: UpdateWorkoutInput) {
  const sb = adminClient();

  const partial: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of UPDATABLE_KEYS) {
    if (input[key] !== undefined) partial[key] = input[key];
  }

  const { data, error } = await sb
    .from("workouts")
    .update(partial)
    .eq("id", input.id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw new Error(`update_workout: ${error.message}`);
  if (!data) throw new Error(`update_workout: workout ${input.id} not found`);
  return data;
}
