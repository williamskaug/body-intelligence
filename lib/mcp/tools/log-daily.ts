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
  muscle_mass_kg: z.number().min(0).max(100).optional(),
  bone_mass_kg: z.number().min(0).max(20).optional(),
  body_water_pct: z.number().min(0).max(100).optional(),
  bp_systolic_mmhg: z.number().int().min(50).max(260).optional(),
  bp_diastolic_mmhg: z.number().int().min(30).max(200).optional(),
  hydration_ml: z.number().int().min(0).max(20_000).optional(),
  skin_temp_deviation_c: z
    .number()
    .min(-10)
    .max(10)
    .optional()
    .describe(
      "Overnight skin/wrist temperature deviation from personal baseline, °C. Universal sensor measurement (Garmin/Oura/Whoop/Apple) — a key early-illness signal.",
    ),
  sleep_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe(
      "Vendor 0-100 last-night sleep score. The factor breakdown stays in daily/YYYY-MM-DD.md.",
    ),
  stress_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe(
      "Vendor daily average stress score 0-100. The stress curve stays in daily/YYYY-MM-DD.md.",
    ),
  body_battery_morning: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe(
      "Body Battery (or equivalent) on waking, 0-100. The hourly curve + charge/drain events stay in daily/YYYY-MM-DD.md.",
    ),
  body_battery_high: z.number().int().min(0).max(100).optional(),
  body_battery_low: z.number().int().min(0).max(100).optional(),
  body_battery_charged: z.number().int().min(0).max(100).optional(),
  body_battery_drained: z.number().int().min(0).max(100).optional(),
  training_readiness_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe(
      "Vendor MORNING training-readiness score 0-100. The factor breakdown stays in daily/YYYY-MM-DD.md. A captured observation — NOT BI's readiness gate (that stays the agent's authored call in derived_daily).",
    ),
  training_status: z
    .string()
    .trim()
    .max(50)
    .optional()
    .describe(
      "Vendor training-status string (e.g. productive, recovery, overreaching). Store lowercased; free-form, no enum.",
    ),
  steps: z.number().int().min(0).max(200_000).optional(),
  active_calories: z.number().int().min(0).max(20_000).optional(),
  floors_climbed: z.number().int().min(0).max(2000).optional(),
  intensity_min_moderate: z.number().int().min(0).max(1440).optional(),
  intensity_min_vigorous: z.number().int().min(0).max(1440).optional(),
  fatigue: wellnessScale
    .optional()
    .describe(
      "1–5. 5 = best (no fatigue). INVERTED relative to natural reading — 5 ALWAYS means good.",
    ),
  soreness: wellnessScale
    .optional()
    .describe(
      "1–5. 5 = best (no soreness). INVERTED — 5 ALWAYS means good, same as fatigue and stress.",
    ),
  mood: wellnessScale.optional().describe("1–5. 5 = best."),
  stress: wellnessScale
    .optional()
    .describe(
      "1–5. 5 = best (no stress). INVERTED — 5 ALWAYS means good, same as fatigue and soreness.",
    ),
  motivation: wellnessScale.optional().describe("1–5. 5 = best."),
  sleep_quality: wellnessScale.optional().describe("1–5. 5 = best."),
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
  muscle_mass_kg?: number;
  bone_mass_kg?: number;
  body_water_pct?: number;
  bp_systolic_mmhg?: number;
  bp_diastolic_mmhg?: number;
  hydration_ml?: number;
  skin_temp_deviation_c?: number;
  sleep_score?: number;
  stress_score?: number;
  body_battery_morning?: number;
  body_battery_high?: number;
  body_battery_low?: number;
  body_battery_charged?: number;
  body_battery_drained?: number;
  training_readiness_score?: number;
  training_status?: string;
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
    "muscle_mass_kg",
    "bone_mass_kg",
    "body_water_pct",
    "bp_systolic_mmhg",
    "bp_diastolic_mmhg",
    "hydration_ml",
    "skin_temp_deviation_c",
    "sleep_score",
    "stress_score",
    "body_battery_morning",
    "body_battery_high",
    "body_battery_low",
    "body_battery_charged",
    "body_battery_drained",
    "training_readiness_score",
    "training_status",
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
