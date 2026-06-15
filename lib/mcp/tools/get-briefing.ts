import { adminClient } from "@/lib/supabase/admin";
import { dateString } from "./shared";

// Convenience read over the briefings/ folder: one call orients an ad-hoc
// session on today's (or the latest) agent-written briefing without the
// caller needing to fs_list + fs_read.
export const getBriefingInputSchema = {
  date: dateString
    .optional()
    .describe(
      "Which day's briefing to read (briefings/YYYY-MM-DD.md). Omit for today, falling back to the most recent briefing if today's hasn't been written yet.",
    ),
};

export type GetBriefingInput = { date?: string };

export async function getBriefing(userId: string, input: GetBriefingInput) {
  const sb = adminClient();

  if (input.date) {
    const { data, error } = await sb
      .from("documents")
      .select("path, content, updated_at")
      .eq("user_id", userId)
      .eq("path", `briefings/${input.date}.md`)
      .maybeSingle();
    if (error) throw new Error(`get_briefing: ${error.message}`);
    return data;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb
    .from("documents")
    .select("path, content, updated_at")
    .eq("user_id", userId)
    .like("path", "briefings/%")
    .lte("path", `briefings/${today}.md`)
    .order("path", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`get_briefing: ${error.message}`);
  return data;
}
