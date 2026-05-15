import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

const MAX_PAGE = 200;
const TS_ISO_RE = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/;

export const listMealsInputSchema = {
  from_date: z.string().regex(TS_ISO_RE, "from_date must be YYYY-MM-DD or ISO timestamp"),
  to_date: z.string().regex(TS_ISO_RE, "to_date must be YYYY-MM-DD or ISO timestamp"),
  meal_type: z.string().trim().max(50).optional(),
  cursor: z.string().max(60).optional(),
  limit: z.number().int().min(1).max(MAX_PAGE).optional(),
};

export type ListMealsInput = {
  from_date: string;
  to_date: string;
  meal_type?: string;
  cursor?: string;
  limit?: number;
};

export async function listMeals(userId: string, input: ListMealsInput) {
  const sb = adminClient();
  const limit = Math.min(input.limit ?? MAX_PAGE, MAX_PAGE);
  const fromIso = input.from_date.includes("T")
    ? input.from_date
    : `${input.from_date}T00:00:00Z`;
  const toIso = input.to_date.includes("T")
    ? input.to_date
    : `${input.to_date}T23:59:59Z`;

  let q = sb
    .from("meals")
    .select("*")
    .eq("user_id", userId)
    .gte("eaten_at", fromIso)
    .lte("eaten_at", toIso)
    .order("eaten_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (input.meal_type) {
    q = q.ilike("meal_type", input.meal_type);
  }
  if (input.cursor) {
    const [cTs, cId] = input.cursor.split("|");
    if (cTs && cId) {
      q = q.or(`eaten_at.lt.${cTs},and(eaten_at.eq.${cTs},id.lt.${cId})`);
    }
  }

  const { data, error } = await q;
  if (error) throw new Error(`list_meals: ${error.message}`);
  const rows = (data ?? []) as Array<{ id: string; eaten_at: string }>;
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const next = hasMore && page.length > 0
    ? `${page[page.length - 1]!.eaten_at}|${page[page.length - 1]!.id}`
    : null;
  return { meals: page, next_cursor: next };
}
