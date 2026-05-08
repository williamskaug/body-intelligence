import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";

export const logWorkoutInputSchema = {
  date: dateString,
  type: z.string().trim().min(1).max(200),
  duration_min: z.number().int().min(0).max(60 * 24).optional(),
  distance_km: z.number().min(0).max(10_000).optional(),
  avg_hr: z.number().int().min(20).max(260).optional(),
  max_hr: z.number().int().min(20).max(260).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  shoes: z.string().trim().max(100).optional(),
  notes: z.string().max(10_000).optional(),
  source: z.string().trim().max(50).default("manual"),
  source_id: z.string().trim().max(200).optional(),
};

export type LogWorkoutInput = {
  date: string;
  type: string;
  duration_min?: number;
  distance_km?: number;
  avg_hr?: number;
  max_hr?: number;
  rpe?: number;
  shoes?: string;
  notes?: string;
  source?: string;
  source_id?: string;
};

export async function logWorkout(userId: string, input: LogWorkoutInput) {
  const sb = adminClient();
  const source = input.source ?? "manual";

  const payload = {
    user_id: userId,
    date: input.date,
    type: input.type,
    duration_min: input.duration_min ?? null,
    distance_km: input.distance_km ?? null,
    avg_hr: input.avg_hr ?? null,
    max_hr: input.max_hr ?? null,
    rpe: input.rpe ?? null,
    shoes: input.shoes ?? null,
    notes: input.notes ?? null,
    source,
    source_id: input.source_id ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.source_id) {
    // Idempotent path: lookup-then-update-or-insert.
    const existing = await sb
      .from("workouts")
      .select("id")
      .eq("user_id", userId)
      .eq("source", source)
      .eq("source_id", input.source_id)
      .maybeSingle();
    if (existing.error) throw new Error(`log_workout lookup: ${existing.error.message}`);

    if (existing.data) {
      const { data, error } = await sb
        .from("workouts")
        .update(payload)
        .eq("id", existing.data.id)
        .select()
        .single();
      if (error) throw new Error(`log_workout update: ${error.message}`);
      return { row: data, action: "updated" as const };
    }
  }

  const { data, error } = await sb.from("workouts").insert(payload).select().single();
  if (error) throw new Error(`log_workout insert: ${error.message}`);
  return { row: data, action: "inserted" as const };
}
