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
  return data;
}
