import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";
import { CAPACITY_FIELDS } from "./log-capacity";

export const getCapacityInputSchema = {
  as_of: dateString
    .optional()
    .describe("Return the latest known value at or before this date (YYYY-MM-DD). Defaults to today."),
};

export type GetCapacityInput = { as_of?: string };

// Returns the most recent non-null value at or before `as_of` for each
// capacity metric, plus the date it was observed. A pure selection over stored
// rows — not a judgment. "Latest known VO2max / FTP / LTHR" in one call.
export async function getCapacity(userId: string, input: GetCapacityInput) {
  const sb = adminClient();
  const asOf = input.as_of ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await sb
    .from("capacity_metrics")
    .select("*")
    .eq("user_id", userId)
    .lte("date", asOf)
    .order("date", { ascending: false });
  if (error) throw new Error(`get_capacity: ${error.message}`);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const latest: Record<string, { value: number; date: string }> = {};
  for (const col of CAPACITY_FIELDS) {
    for (const row of rows) {
      const v = row[col];
      if (v !== null && v !== undefined) {
        const num = Number(v);
        if (Number.isFinite(num)) {
          latest[col] = { value: num, date: row.date as string };
          break;
        }
      }
    }
  }

  return { as_of: asOf, metrics: latest };
}
