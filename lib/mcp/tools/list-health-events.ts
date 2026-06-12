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
  const events = (data ?? []) as Array<{ id: string }>;
  if (events.length === 0) return { health_events: [] };

  // Attach latest_update + update_count per event in one batched query.
  const { data: updates, error: updErr } = await sb
    .from("health_event_updates")
    .select("event_id, date, note, severity_at_time")
    .eq("user_id", userId)
    .in("event_id", events.map((e) => e.id))
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (updErr) throw new Error(`list_health_events updates: ${updErr.message}`);

  const latestByEvent = new Map<string, { date: string; note: string; severity_at_time: number | null }>();
  const countByEvent = new Map<string, number>();
  for (const u of (updates ?? []) as Array<{
    event_id: string;
    date: string;
    note: string;
    severity_at_time: number | null;
  }>) {
    countByEvent.set(u.event_id, (countByEvent.get(u.event_id) ?? 0) + 1);
    if (!latestByEvent.has(u.event_id)) {
      latestByEvent.set(u.event_id, {
        date: u.date,
        note: u.note,
        severity_at_time: u.severity_at_time,
      });
    }
  }

  return {
    health_events: events.map((e) => ({
      ...e,
      latest_update: latestByEvent.get(e.id) ?? null,
      update_count: countByEvent.get(e.id) ?? 0,
    })),
  };
}
