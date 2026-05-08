import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const fsListInputSchema = {
  prefix: z.string().trim().max(255).optional(),
};

export type FsListInput = { prefix?: string };

export async function fsList(userId: string, input: FsListInput) {
  const sb = adminClient();
  let query = sb
    .from("documents")
    .select("path, updated_at")
    .eq("user_id", userId);

  if (input.prefix) {
    query = query.like("path", `${input.prefix}%`);
  }

  const { data, error } = await query.order("path", { ascending: true });
  if (error) throw new Error(`fs_list: ${error.message}`);
  return data;
}
