import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const getHealthEventInputSchema = {
  id: z.string().uuid(),
};

export type GetHealthEventInput = { id: string };

export async function getHealthEvent(userId: string, input: GetHealthEventInput) {
  const sb = adminClient();
  const { data, error } = await sb
    .from("health_events")
    .select("*")
    .eq("user_id", userId)
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(`get_health_event: ${error.message}`);
  if (!data) return null;

  const updates = await sb
    .from("health_event_updates")
    .select("id, date, note, severity_at_time, created_at")
    .eq("user_id", userId)
    .eq("event_id", input.id)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  if (updates.error) throw new Error(`get_health_event updates: ${updates.error.message}`);

  return { ...data, updates: updates.data ?? [] };
}
