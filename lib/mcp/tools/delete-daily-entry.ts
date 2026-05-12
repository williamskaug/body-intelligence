import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";

export const deleteDailyEntryInputSchema = {
  date: dateString,
};

export type DeleteDailyEntryInput = { date: string };

export async function deleteDailyEntry(
  userId: string,
  input: DeleteDailyEntryInput,
) {
  const sb = adminClient();
  const { data, error } = await sb
    .from("daily_entries")
    .delete()
    .eq("user_id", userId)
    .eq("date", input.date)
    .select("id, date")
    .maybeSingle();
  if (error) throw new Error(`delete_daily_entry: ${error.message}`);
  if (!data)
    throw new Error(
      `delete_daily_entry: no daily entry found for ${input.date}`,
    );
  return { id: data.id, date: data.date, deleted: true as const };
}
