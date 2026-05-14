import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const listHealthEventsInputSchema = {
  active_only: z
    .boolean()
    .optional()
    .describe("If true, only unresolved events. Default: true."),
  kind: z.enum(["injury", "illness", "symptom"]).optional(),
  limit: z.number().int().min(1).max(500).optional(),
};

export type ListHealthEventsInput = {
  active_only?: boolean;
  kind?: "injury" | "illness" | "symptom";
  limit?: number;
};

export async function listHealthEvents(userId: string, input: ListHealthEventsInput) {
  const sb = adminClient();
  const activeOnly = input.active_only ?? true;
  const limit = input.limit ?? 200;

  let q = sb
    .from("health_events")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(limit);
  if (activeOnly) {
    q = q.is("resolved_date", null);
  }
  if (input.kind) {
    q = q.eq("kind", input.kind);
  }
  const { data, error } = await q;
  if (error) throw new Error(`list_health_events: ${error.message}`);
  return { health_events: data ?? [] };
}
