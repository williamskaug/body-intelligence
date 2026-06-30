import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { logWorkoutInputSchema } from "./log-workout";
import { normalizeWorkoutType } from "./shared";
import { upsertWorkoutMetrics } from "./workout-metrics";
import { upsertWorkoutZones } from "./workout-zones";

const MAX_BATCH = 500;

const itemSchema = z.object(logWorkoutInputSchema);

export const bulkLogWorkoutsInputSchema = {
  items: z.array(itemSchema).min(1).max(MAX_BATCH),
  on_conflict: z.enum(["ignore", "update"]).default("update"),
};

export type BulkLogWorkoutsInput = {
  items: z.infer<typeof itemSchema>[];
  on_conflict?: "ignore" | "update";
};

export async function bulkLogWorkouts(userId: string, input: BulkLogWorkoutsInput) {
  const sb = adminClient();
  const onConflict = input.on_conflict ?? "update";
  const nowIso = new Date().toISOString();
  const errors: Array<{ index: number; error: string }> = [];
  let inserted = 0;
  let updated = 0;

  // Split into rows with source_id (idempotent path) and without.
  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i]!;
    const payload = {
      user_id: userId,
      date: it.date,
      type: normalizeWorkoutType(it.type),
      duration_min: it.duration_min ?? null,
      distance_km: it.distance_km ?? null,
      avg_hr: it.avg_hr ?? null,
      max_hr: it.max_hr ?? null,
      rpe: it.rpe ?? null,
      shoes: it.shoes ?? null,
      notes: it.notes ?? null,
      source: it.source ?? "manual",
      source_id: it.source_id ?? null,
      updated_at: nowIso,
    };

    if (it.source_id) {
      const existing = await sb
        .from("workouts")
        .select("id")
        .eq("user_id", userId)
        .eq("source", payload.source)
        .eq("source_id", it.source_id)
        .maybeSingle();
      if (existing.error) {
        errors.push({ index: i, error: existing.error.message });
        continue;
      }
      if (existing.data) {
        if (onConflict === "ignore") continue;
        const { error: upErr } = await sb
          .from("workouts")
          .update(payload)
          .eq("id", existing.data.id);
        if (upErr) {
          errors.push({ index: i, error: upErr.message });
          continue;
        }
        if (it.metrics) {
          try {
            await upsertWorkoutMetrics(sb, userId, existing.data.id, it.date, it.metrics);
          } catch (e) {
            errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
            continue;
          }
        }
        if (it.zones) {
          try {
            await upsertWorkoutZones(sb, userId, existing.data.id, it.date, it.zones);
          } catch (e) {
            errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
            continue;
          }
        }
        updated++;
        continue;
      }
    }

    const { data: insertedRow, error } = await sb
      .from("workouts")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      errors.push({ index: i, error: error.message });
      continue;
    }
    if (it.metrics) {
      try {
        await upsertWorkoutMetrics(sb, userId, insertedRow.id, it.date, it.metrics);
      } catch (e) {
        errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
        continue;
      }
    }
    if (it.zones) {
      try {
        await upsertWorkoutZones(sb, userId, insertedRow.id, it.date, it.zones);
      } catch (e) {
        errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
        continue;
      }
    }
    inserted++;
  }

  return { inserted, updated, errors };
}
