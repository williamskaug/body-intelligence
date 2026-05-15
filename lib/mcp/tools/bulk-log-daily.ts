import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { logDailyInputSchema } from "./log-daily";

const MAX_BATCH = 500;
const itemSchema = z.object(logDailyInputSchema);

export const bulkLogDailyInputSchema = {
  items: z.array(itemSchema).min(1).max(MAX_BATCH),
  on_conflict: z.enum(["ignore", "update"]).default("update"),
};

export type BulkLogDailyInput = {
  items: z.infer<typeof itemSchema>[];
  on_conflict?: "ignore" | "update";
};

const DAILY_FIELDS = [
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
] as const;

export async function bulkLogDaily(userId: string, input: BulkLogDailyInput) {
  const sb = adminClient();
  const onConflict = input.on_conflict ?? "update";
  const nowIso = new Date().toISOString();
  const errors: Array<{ index: number; error: string }> = [];
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i]!;
    const partial: Record<string, unknown> = { updated_at: nowIso };
    for (const key of DAILY_FIELDS) {
      const v = (it as Record<string, unknown>)[key];
      if (v !== undefined) partial[key] = v;
    }

    const existing = await sb
      .from("daily_entries")
      .select("id")
      .eq("user_id", userId)
      .eq("date", it.date)
      .maybeSingle();
    if (existing.error) {
      errors.push({ index: i, error: existing.error.message });
      continue;
    }
    if (existing.data) {
      if (onConflict === "ignore") continue;
      const { error: upErr } = await sb
        .from("daily_entries")
        .update(partial)
        .eq("id", existing.data.id);
      if (upErr) errors.push({ index: i, error: upErr.message });
      else updated++;
    } else {
      const { error: inErr } = await sb
        .from("daily_entries")
        .insert({ user_id: userId, date: it.date, ...partial });
      if (inErr) errors.push({ index: i, error: inErr.message });
      else inserted++;
    }
  }
  return { inserted, updated, errors };
}
