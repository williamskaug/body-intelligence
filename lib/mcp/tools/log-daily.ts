import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { dateString, wellnessScale } from "./shared";

export const logDailyInputSchema = {
  date: dateString,
  sleep_h: z.number().min(0).max(24).optional(),
  sleep_deep_min: z.number().int().min(0).max(1440).optional(),
  sleep_light_min: z.number().int().min(0).max(1440).optional(),
  sleep_rem_min: z.number().int().min(0).max(1440).optional(),
  sleep_awake_min: z.number().int().min(0).max(1440).optional(),
  hrv_ms: z.number().int().min(0).max(500).optional(),
  rhr_bpm: z.number().int().min(20).max(200).optional(),
  spo2_avg_pct: z.number().min(50).max(100).optional(),
  respiration_avg_brpm: z.number().min(4).max(40).optional(),
  weight_kg: z.number().min(20).max(400).optional(),
  body_fat_pct: z.number().min(2).max(70).optional(),
  steps: z.number().int().min(0).max(200_000).optional(),
  active_calories: z.number().int().min(0).max(20_000).optional(),
  floors_climbed: z.number().int().min(0).max(2000).optional(),
  intensity_min_moderate: z.number().int().min(0).max(1440).optional(),
  intensity_min_vigorous: z.number().int().min(0).max(1440).optional(),
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
  sleep_deep_min?: number;
  sleep_light_min?: number;
  sleep_rem_min?: number;
  sleep_awake_min?: number;
  hrv_ms?: number;
  rhr_bpm?: number;
  spo2_avg_pct?: number;
  respiration_avg_brpm?: number;
  weight_kg?: number;
  body_fat_pct?: number;
  steps?: number;
  active_calories?: number;
  floors_climbed?: number;
  intensity_min_moderate?: number;
  intensity_min_vigorous?: number;
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
    "sleep_deep_min",
    "sleep_light_min",
    "sleep_rem_min",
    "sleep_awake_min",
    "hrv_ms",
    "rhr_bpm",
    "spo2_avg_pct",
    "respiration_avg_brpm",
    "weight_kg",
    "body_fat_pct",
    "steps",
    "active_calories",
    "floors_climbed",
    "intensity_min_moderate",
    "intensity_min_vigorous",
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
