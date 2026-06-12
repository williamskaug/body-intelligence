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
  notes: z
    .string()
    .max(10_000)
    .nullable()
    .optional()
    .describe(
      "The event SUMMARY (mechanism, working hypothesis, management plan). Do NOT append dated status updates here — use add_health_event_update for those.",
    ),
  resolved_date: dateString.nullable().optional(),
  next_milestone_date: dateString
    .nullable()
    .optional()
    .describe("Date of the next checkpoint gating progression (e.g. imaging). Null to clear."),
  next_milestone: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .describe("What the checkpoint is, e.g. 'MRI + X-ray — structural clearance gate'."),
};

export type UpdateHealthEventInput = {
  id: string;
  date?: string;
  kind?: "injury" | "illness" | "symptom";
  body_part?: string | null;
  severity?: number | null;
  notes?: string | null;
  resolved_date?: string | null;
  next_milestone_date?: string | null;
  next_milestone?: string | null;
};

const UPDATABLE_KEYS = [
  "date",
  "kind",
  "body_part",
  "severity",
  "notes",
  "resolved_date",
  "next_milestone_date",
  "next_milestone",
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
