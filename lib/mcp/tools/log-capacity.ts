import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";

// Slow-moving fitness-capacity snapshot. Written weekly by the capacity-sync
// recipe from the wearable's lab-style estimates. Partial-merge upsert by
// (user, date) — a mid-week re-run patches the same row without wiping fields
// the connector didn't return this time. BI STORES the vendor estimate; it
// never computes capacity.
export const logCapacityInputSchema = {
  date: dateString,
  vo2max_running: z.number().min(10).max(90).optional(),
  vo2max_cycling: z.number().min(10).max(90).optional(),
  lactate_threshold_hr_bpm: z.number().int().min(60).max(220).optional(),
  lactate_threshold_pace_s_per_km: z
    .number()
    .int()
    .min(1)
    .max(1800)
    .optional()
    .describe("Threshold running pace in seconds per km (e.g. 4:00/km = 240)."),
  lactate_threshold_power_w: z.number().int().min(0).max(2000).optional(),
  cycling_ftp_w: z.number().int().min(0).max(2000).optional(),
  endurance_score: z.number().int().min(0).max(20_000).optional(),
  hill_score: z.number().int().min(0).max(100).optional(),
  fitness_age_years: z.number().min(10).max(100).optional(),
  running_tolerance_km: z.number().min(0).max(2000).optional(),
  race_pred_5k_s: z.number().int().min(1).max(36_000).optional(),
  race_pred_10k_s: z.number().int().min(1).max(72_000).optional(),
  race_pred_half_s: z.number().int().min(1).max(144_000).optional(),
  race_pred_marathon_s: z.number().int().min(1).max(288_000).optional(),
};

export type LogCapacityInput = {
  date: string;
  vo2max_running?: number;
  vo2max_cycling?: number;
  lactate_threshold_hr_bpm?: number;
  lactate_threshold_pace_s_per_km?: number;
  lactate_threshold_power_w?: number;
  cycling_ftp_w?: number;
  endurance_score?: number;
  hill_score?: number;
  fitness_age_years?: number;
  running_tolerance_km?: number;
  race_pred_5k_s?: number;
  race_pred_10k_s?: number;
  race_pred_half_s?: number;
  race_pred_marathon_s?: number;
};

export const CAPACITY_FIELDS = [
  "vo2max_running",
  "vo2max_cycling",
  "lactate_threshold_hr_bpm",
  "lactate_threshold_pace_s_per_km",
  "lactate_threshold_power_w",
  "cycling_ftp_w",
  "endurance_score",
  "hill_score",
  "fitness_age_years",
  "running_tolerance_km",
  "race_pred_5k_s",
  "race_pred_10k_s",
  "race_pred_half_s",
  "race_pred_marathon_s",
] as const;

export async function logCapacity(userId: string, input: LogCapacityInput) {
  const sb = adminClient();

  // Partial-merge: undefined fields are skipped so a mid-week patch doesn't
  // clobber last week's snapshot.
  const partial: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of CAPACITY_FIELDS) {
    if (input[key] !== undefined) partial[key] = input[key];
  }

  const existing = await sb
    .from("capacity_metrics")
    .select("id")
    .eq("user_id", userId)
    .eq("date", input.date)
    .maybeSingle();
  if (existing.error) throw new Error(`log_capacity lookup: ${existing.error.message}`);

  if (existing.data) {
    const { data, error } = await sb
      .from("capacity_metrics")
      .update(partial)
      .eq("id", existing.data.id)
      .select()
      .single();
    if (error) throw new Error(`log_capacity update: ${error.message}`);
    return data;
  }

  const { data, error } = await sb
    .from("capacity_metrics")
    .insert({ user_id: userId, date: input.date, ...partial })
    .select()
    .single();
  if (error) throw new Error(`log_capacity insert: ${error.message}`);
  return data;
}
