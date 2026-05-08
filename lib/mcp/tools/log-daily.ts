import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { dateString, wellnessScale } from "./shared";

export const logDailyInputSchema = {
  date: dateString,
  sleep_h: z.number().min(0).max(24).optional(),
  hrv_ms: z.number().int().min(0).max(500).optional(),
  rhr_bpm: z.number().int().min(20).max(200).optional(),
  weight_kg: z.number().min(20).max(400).optional(),
  fatigue: wellnessScale.optional(),
  soreness: wellnessScale.optional(),
  mood: wellnessScale.optional(),
  stress: wellnessScale.optional(),
  motivation: wellnessScale.optional(),
  sleep_quality: wellnessScale.optional(),
  sleep_notes: z.string().max(10_000).optional(),
  wellness_notes: z.string().max(10_000).optional(),
  meal_notes: z.string().max(10_000).optional(),
};

export type LogDailyInput = {
  date: string;
  sleep_h?: number;
  hrv_ms?: number;
  rhr_bpm?: number;
  weight_kg?: number;
  fatigue?: number;
  soreness?: number;
  mood?: number;
  stress?: number;
  motivation?: number;
  sleep_quality?: number;
  sleep_notes?: string;
  wellness_notes?: string;
  meal_notes?: string;
};

export async function logDaily(userId: string, input: LogDailyInput) {
  const sb = adminClient();

  // Build a partial payload — undefined fields are skipped, so a partial call
  // (e.g. just sleep_h) doesn't clobber unrelated columns.
  const partial: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of [
    "sleep_h",
    "hrv_ms",
    "rhr_bpm",
    "weight_kg",
    "fatigue",
    "soreness",
    "mood",
    "stress",
    "motivation",
    "sleep_quality",
    "sleep_notes",
    "wellness_notes",
    "meal_notes",
  ] as const) {
    if (input[key] !== undefined) partial[key] = input[key];
  }

  const existing = await sb
    .from("daily_entries")
    .select("id")
    .eq("user_id", userId)
    .eq("date", input.date)
    .maybeSingle();
  if (existing.error) throw new Error(`log_daily lookup: ${existing.error.message}`);

  if (existing.data) {
    const { data, error } = await sb
      .from("daily_entries")
      .update(partial)
      .eq("id", existing.data.id)
      .select()
      .single();
    if (error) throw new Error(`log_daily update: ${error.message}`);
    return data;
  }

  const { data, error } = await sb
    .from("daily_entries")
    .insert({ user_id: userId, date: input.date, ...partial })
    .select()
    .single();
  if (error) throw new Error(`log_daily insert: ${error.message}`);
  return data;
}
