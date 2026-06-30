import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { weeklyBuckets } from "@/lib/data-display/aggregate";

export const computeTrainingLoadInputSchema = {
  days: z
    .number()
    .int()
    .min(7)
    .max(365)
    .describe("How many trailing days to include. 84 (12 weeks) is a useful default."),
};

export type ComputeTrainingLoadInput = { days: number };

export async function computeTrainingLoad(userId: string, input: ComputeTrainingLoadInput) {
  const sb = adminClient();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - input.days);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data, error } = await sb
    .from("workouts")
    .select("date, type, duration_min, rpe")
    .eq("user_id", userId)
    .gte("date", sinceIso);
  if (error) throw new Error(`compute_training_load: ${error.message}`);

  const rows = (data ?? []) as Array<{
    date: string;
    type: string;
    duration_min: number | null;
    rpe: number | null;
  }>;

  const weeks = Math.ceil(input.days / 7);
  const buckets = weeklyBuckets(rows, weeks, todayIso);

  return {
    days: input.days,
    computed_as_of: todayIso,
    buckets,
    note: "Weekly buckets using duration × (rpe ?? 5) as a TRIMP-lite intensity-weighted load. For daily CTL/ATL/TSB (fitness/fatigue/form), use get_load_balance.",
  };
}
