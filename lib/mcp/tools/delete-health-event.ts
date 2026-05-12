import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const deleteHealthEventInputSchema = {
  id: z.string().uuid(),
};

export type DeleteHealthEventInput = { id: string };

export async function deleteHealthEvent(
  userId: string,
  input: DeleteHealthEventInput,
) {
  const sb = adminClient();
  const { data, error } = await sb
    .from("health_events")
    .delete()
    .eq("id", input.id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`delete_health_event: ${error.message}`);
  if (!data)
    throw new Error(`delete_health_event: health event ${input.id} not found`);
  return { id: data.id, deleted: true as const };
}
