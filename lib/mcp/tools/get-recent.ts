import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

const KIND_VALUES = ["workouts", "daily", "meals", "health_events"] as const;

export const getRecentInputSchema = {
  days: z.number().int().min(1).max(90),
  kinds: z.array(z.enum(KIND_VALUES)).optional(),
};

export type GetRecentInput = {
  days: number;
  kinds?: Array<(typeof KIND_VALUES)[number]>;
};

export async function getRecent(userId: string, input: GetRecentInput) {
  const sb = adminClient();
  const wanted = new Set(input.kinds ?? KIND_VALUES);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - input.days);
  const sinceDate = since.toISOString().slice(0, 10); // YYYY-MM-DD
  const sinceIso = since.toISOString();

  const result: {
    workouts: unknown[];
    daily: unknown[];
    meals: unknown[];
    health_events: unknown[];
  } = { workouts: [], daily: [], meals: [], health_events: [] };

  if (wanted.has("workouts")) {
    const { data, error } = await sb
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceDate)
      .order("date", { ascending: false });
    if (error) throw new Error(`get_recent workouts: ${error.message}`);
    result.workouts = data ?? [];
  }

  if (wanted.has("daily")) {
    const { data, error } = await sb
      .from("daily_entries")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceDate)
      .order("date", { ascending: false });
    if (error) throw new Error(`get_recent daily: ${error.message}`);
    result.daily = data ?? [];
  }

  if (wanted.has("meals")) {
    const { data, error } = await sb
      .from("meals")
      .select("*")
      .eq("user_id", userId)
      .gte("eaten_at", sinceIso)
      .order("eaten_at", { ascending: false });
    if (error) throw new Error(`get_recent meals: ${error.message}`);
    result.meals = data ?? [];
  }

  if (wanted.has("health_events")) {
    // Recent OR unresolved (active issues stick around past the window).
    const { data: recent, error: e1 } = await sb
      .from("health_events")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceDate)
      .order("date", { ascending: false });
    if (e1) throw new Error(`get_recent health_events recent: ${e1.message}`);

    const { data: openOlder, error: e2 } = await sb
      .from("health_events")
      .select("*")
      .eq("user_id", userId)
      .lt("date", sinceDate)
      .is("resolved_date", null)
      .order("date", { ascending: false });
    if (e2) throw new Error(`get_recent health_events open: ${e2.message}`);

    const seen = new Set<string>();
    const merged: unknown[] = [];
    for (const row of [...(recent ?? []), ...(openOlder ?? [])]) {
      const id = (row as { id: string }).id;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
    }
    result.health_events = merged;
  }

  return result;
}
