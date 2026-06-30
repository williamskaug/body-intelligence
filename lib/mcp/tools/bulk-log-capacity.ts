import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { CAPACITY_FIELDS, logCapacityInputSchema } from "./log-capacity";

const MAX_BATCH = 500;
const itemSchema = z.object(logCapacityInputSchema);

export const bulkLogCapacityInputSchema = {
  items: z.array(itemSchema).min(1).max(MAX_BATCH),
  on_conflict: z.enum(["ignore", "update"]).default("update"),
};

export type BulkLogCapacityInput = {
  items: z.infer<typeof itemSchema>[];
  on_conflict?: "ignore" | "update";
};

export async function bulkLogCapacity(userId: string, input: BulkLogCapacityInput) {
  const sb = adminClient();
  const onConflict = input.on_conflict ?? "update";
  const nowIso = new Date().toISOString();
  const errors: Array<{ index: number; error: string }> = [];
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i]!;
    const partial: Record<string, unknown> = { updated_at: nowIso };
    for (const key of CAPACITY_FIELDS) {
      const v = (it as Record<string, unknown>)[key];
      if (v !== undefined) partial[key] = v;
    }

    const existing = await sb
      .from("capacity_metrics")
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
        .from("capacity_metrics")
        .update(partial)
        .eq("id", existing.data.id);
      if (upErr) errors.push({ index: i, error: upErr.message });
      else updated++;
    } else {
      const { error: inErr } = await sb
        .from("capacity_metrics")
        .insert({ user_id: userId, date: it.date, ...partial });
      if (inErr) errors.push({ index: i, error: inErr.message });
      else inserted++;
    }
  }
  return { inserted, updated, errors };
}
