import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";

export const getDailyInputSchema = {
  date: dateString,
};

export type GetDailyInput = { date: string };

export async function getDaily(userId: string, input: GetDailyInput) {
  const sb = adminClient();
  const { data, error } = await sb
    .from("daily_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("date", input.date)
    .maybeSingle();
  if (error) throw new Error(`get_daily: ${error.message}`);
  return data;
}
