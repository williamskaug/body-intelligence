import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";

export const logHealthEventInputSchema = {
  date: dateString,
  kind: z.enum(["injury", "illness", "symptom"]),
  body_part: z.string().trim().max(100).optional(),
  severity: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .describe(
      "1–5. 5 = MOST SEVERE. Opposite direction from the wellness scales (where 5 = best). The one place in BI where 5 = bad.",
    ),
  notes: z.string().max(10_000).optional(),
  resolved_date: dateString.optional(),
};

export type LogHealthEventInput = {
  date: string;
  kind: "injury" | "illness" | "symptom";
  body_part?: string;
  severity?: number;
  notes?: string;
  resolved_date?: string;
};

export async function logHealthEvent(userId: string, input: LogHealthEventInput) {
  const sb = adminClient();
  const { data, error } = await sb
    .from("health_events")
    .insert({
      user_id: userId,
      date: input.date,
      kind: input.kind,
      body_part: input.body_part ?? null,
      severity: input.severity ?? null,
      notes: input.notes ?? null,
      resolved_date: input.resolved_date ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`log_health_event insert: ${error.message}`);
  return data;
}
