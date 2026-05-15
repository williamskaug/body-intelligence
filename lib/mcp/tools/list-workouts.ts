import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";

const MAX_PAGE = 200;

export const listWorkoutsInputSchema = {
  from_date: dateString,
  to_date: dateString,
  type: z
    .string()
    .trim()
    .max(50)
    .optional()
    .describe("Optional case-insensitive filter on workouts.type."),
  cursor: z
    .string()
    .max(40)
    .optional()
    .describe(
      "Pagination cursor — pass the next_cursor from a previous response to continue.",
    ),
  limit: z.number().int().min(1).max(MAX_PAGE).optional(),
};

export type ListWorkoutsInput = {
  from_date: string;
  to_date: string;
  type?: string;
  cursor?: string;
  limit?: number;
};

export async function listWorkouts(userId: string, input: ListWorkoutsInput) {
  const sb = adminClient();
  const limit = Math.min(input.limit ?? MAX_PAGE, MAX_PAGE);
  let q = sb
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .gte("date", input.from_date)
    .lte("date", input.to_date)
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (input.type) {
    q = q.ilike("type", input.type);
  }
  if (input.cursor) {
    // cursor encodes "date|id" so the next page picks up after the last row.
    const [cDate, cId] = input.cursor.split("|");
    if (cDate && cId) {
      q = q.or(`date.lt.${cDate},and(date.eq.${cDate},id.lt.${cId})`);
    }
  }

  const { data, error } = await q;
  if (error) throw new Error(`list_workouts: ${error.message}`);
  const rows = (data ?? []) as Array<{ id: string; date: string }>;
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const next = hasMore && page.length > 0
    ? `${page[page.length - 1]!.date}|${page[page.length - 1]!.id}`
    : null;

  return { workouts: page, next_cursor: next };
}
