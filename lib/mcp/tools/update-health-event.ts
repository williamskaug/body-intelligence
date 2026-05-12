import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";

// Updates are how an event gets resolved: pass resolved_date to mark the
// injury / illness / symptom as past. Pass resolved_date: null to re-open one.
export const updateHealthEventInputSchema = {
  id: z.string().uuid(),
  date: dateString.optional(),
  kind: z.enum(["injury", "illness", "symptom"]).optional(),
  body_part: z.string().trim().max(100).nullable().optional(),
  severity: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
  resolved_date: dateString.nullable().optional(),
};

export type UpdateHealthEventInput = {
  id: string;
  date?: string;
  kind?: "injury" | "illness" | "symptom";
  body_part?: string | null;
  severity?: number | null;
  notes?: string | null;
  resolved_date?: string | null;
};

const UPDATABLE_KEYS = [
  "date",
  "kind",
  "body_part",
  "severity",
  "notes",
  "resolved_date",
] as const;

export async function updateHealthEvent(
  userId: string,
  input: UpdateHealthEventInput,
) {
  const sb = adminClient();

  const partial: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of UPDATABLE_KEYS) {
    if (input[key] !== undefined) partial[key] = input[key];
  }

  const { data, error } = await sb
    .from("health_events")
    .update(partial)
    .eq("id", input.id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw new Error(`update_health_event: ${error.message}`);
  if (!data)
    throw new Error(`update_health_event: health event ${input.id} not found`);
  return data;
}
