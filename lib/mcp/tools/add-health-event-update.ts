import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";

// Dated thread update on a health event — the replacement for appending
// "STATUS JUN 8: ..." blocks into health_events.notes. The event row stays
// the summary; the day-to-day story accumulates here.
export const addHealthEventUpdateInputSchema = {
  event_id: z.string().uuid(),
  date: dateString,
  note: z.string().min(1).max(5000),
  severity_at_time: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .describe(
      "Severity as of this update (1-5, 5 = most severe). Also patches health_events.severity so the event row tracks the latest assessment.",
    ),
  on_same_date: z
    .enum(["replace", "append"])
    .default("replace")
    .describe(
      "What to do when an update already exists for this (event, date). 'replace' (default) makes scheduled re-runs idempotent; pass 'append' for a deliberate second note on the same day.",
    ),
};

export type AddHealthEventUpdateInput = {
  event_id: string;
  date: string;
  note: string;
  severity_at_time?: number;
  on_same_date?: "replace" | "append";
};

export async function addHealthEventUpdate(
  userId: string,
  input: AddHealthEventUpdateInput,
) {
  const sb = adminClient();
  const mode = input.on_same_date ?? "replace";

  // Verify ownership before writing the child row.
  const event = await sb
    .from("health_events")
    .select("id")
    .eq("user_id", userId)
    .eq("id", input.event_id)
    .maybeSingle();
  if (event.error) throw new Error(`add_health_event_update lookup: ${event.error.message}`);
  if (!event.data)
    throw new Error(`add_health_event_update: health event ${input.event_id} not found`);

  let row: unknown;
  if (mode === "replace") {
    const existing = await sb
      .from("health_event_updates")
      .select("id")
      .eq("user_id", userId)
      .eq("event_id", input.event_id)
      .eq("date", input.date)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error)
      throw new Error(`add_health_event_update lookup: ${existing.error.message}`);

    if (existing.data) {
      const { data, error } = await sb
        .from("health_event_updates")
        .update({
          note: input.note,
          severity_at_time: input.severity_at_time ?? null,
        })
        .eq("id", existing.data.id)
        .select()
        .single();
      if (error) throw new Error(`add_health_event_update replace: ${error.message}`);
      row = data;
    }
  }

  if (!row) {
    const { data, error } = await sb
      .from("health_event_updates")
      .insert({
        user_id: userId,
        event_id: input.event_id,
        date: input.date,
        note: input.note,
        severity_at_time: input.severity_at_time ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(`add_health_event_update insert: ${error.message}`);
    row = data;
  }

  if (input.severity_at_time !== undefined) {
    const { error } = await sb
      .from("health_events")
      .update({
        severity: input.severity_at_time,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.event_id)
      .eq("user_id", userId);
    if (error) throw new Error(`add_health_event_update severity sync: ${error.message}`);
  }

  return { update: row };
}
