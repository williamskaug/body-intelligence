import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";

const MAX_PAGE = 200;

export const listDailyInputSchema = {
  from_date: dateString,
  to_date: dateString,
  cursor: dateString.optional(),
  limit: z.number().int().min(1).max(MAX_PAGE).optional(),
};

export type ListDailyInput = {
  from_date: string;
  to_date: string;
  cursor?: string;
  limit?: number;
};

export async function listDaily(userId: string, input: ListDailyInput) {
  const sb = adminClient();
  const limit = Math.min(input.limit ?? MAX_PAGE, MAX_PAGE);
  let q = sb
    .from("daily_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("date", input.from_date)
    .lte("date", input.to_date)
    .order("date", { ascending: false })
    .limit(limit + 1);

  if (input.cursor) {
    q = q.lt("date", input.cursor);
  }

  const { data, error } = await q;
  if (error) throw new Error(`list_daily: ${error.message}`);
  const rows = (data ?? []) as Array<{ date: string }>;
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const next = hasMore && page.length > 0
    ? page[page.length - 1]!.date
    : null;
  return { daily: page, next_cursor: next };
}
