import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";

const gateValue = z.enum(["green", "amber", "red"]);
const zScore = z.number().min(-99).max(99);

// BI never computes these values — this is where YOUR computed derived layer
// is stored so the dashboard can render and trend it. Writes are a FULL-ROW
// REPLACE per (user, date): omitted optional fields become NULL. This is the
// opposite of log_daily's merge semantics, on purpose — a recompute must
// never leave yesterday's stale flags behind.
export const logDerivedDailyInputSchema = {
  date: dateString,
  readiness_gate: gateValue
    .optional()
    .describe(
      "Today's training ceiling as called by the agent: green = quality allowed, amber = easy/Z2 only, red = rest.",
    ),
  gate_reason: z
    .string()
    .max(500)
    .optional()
    .describe("One line: why the gate is what it is. The narrative lives in briefings/."),
  illness_composite: gateValue
    .optional()
    .describe("Illness/overreach composite verdict (e.g. red if ≥2 signal flags)."),
  skin_temp_flag: z.boolean().optional(),
  hrv_flag: z.boolean().optional(),
  rhr_flag: z.boolean().optional(),
  resp_flag: z.boolean().optional(),
  hrv_z: zScore.optional().describe("Today's HRV z-score vs the trailing personal baseline."),
  rhr_z: zScore.optional(),
  sleep_z: zScore.optional(),
  sleep_debt_7d_min: z.number().int().min(0).max(10_000).optional(),
  sleep_need_min: z.number().int().min(0).max(1440).optional(),
  acute_load_7d: z.number().min(0).max(100_000).optional(),
  chronic_load_28d: z.number().min(0).max(100_000).optional(),
  days_to_race: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .optional()
    .describe("Days to the next race in GOALS.md — derived FROM the markdown, which stays source of truth."),
  computed_by: z
    .string()
    .trim()
    .max(100)
    .default("agent")
    .describe("Which recipe computed this row, e.g. 'dawn-agent'."),
};

export type LogDerivedDailyInput = {
  date: string;
  readiness_gate?: "green" | "amber" | "red";
  gate_reason?: string;
  illness_composite?: "green" | "amber" | "red";
  skin_temp_flag?: boolean;
  hrv_flag?: boolean;
  rhr_flag?: boolean;
  resp_flag?: boolean;
  hrv_z?: number;
  rhr_z?: number;
  sleep_z?: number;
  sleep_debt_7d_min?: number;
  sleep_need_min?: number;
  acute_load_7d?: number;
  chronic_load_28d?: number;
  days_to_race?: number;
  computed_by?: string;
};

const REPLACE_COLUMNS = [
  "readiness_gate",
  "gate_reason",
  "illness_composite",
  "skin_temp_flag",
  "hrv_flag",
  "rhr_flag",
  "resp_flag",
  "hrv_z",
  "rhr_z",
  "sleep_z",
  "sleep_debt_7d_min",
  "sleep_need_min",
  "acute_load_7d",
  "chronic_load_28d",
  "days_to_race",
] as const;

export async function logDerivedDaily(userId: string, input: LogDerivedDailyInput) {
  const sb = adminClient();
  const nowIso = new Date().toISOString();

  const payload: Record<string, unknown> = {
    user_id: userId,
    date: input.date,
    computed_by: input.computed_by ?? "agent",
    computed_at: nowIso,
    updated_at: nowIso,
  };
  // Full replace: every column is written, missing inputs as NULL.
  for (const key of REPLACE_COLUMNS) {
    payload[key] = input[key] ?? null;
  }

  const { data, error } = await sb
    .from("derived_daily")
    .upsert(payload, { onConflict: "user_id,date" })
    .select()
    .single();
  if (error) throw new Error(`log_derived_daily: ${error.message}`);
  return data;
}
