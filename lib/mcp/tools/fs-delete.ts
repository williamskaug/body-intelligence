import { adminClient } from "@/lib/supabase/admin";
import { documentPath } from "./shared";

export const fsDeleteInputSchema = {
  path: documentPath,
};

export type FsDeleteInput = { path: string };

export async function fsDelete(userId: string, input: FsDeleteInput) {
  const sb = adminClient();
  const { data, error } = await sb
    .from("documents")
    .delete()
    .eq("user_id", userId)
    .eq("path", input.path)
    .select("path")
    .maybeSingle();
  if (error) throw new Error(`fs_delete: ${error.message}`);
  if (!data) throw new Error(`fs_delete: document ${input.path} not found`);
  return { path: data.path, deleted: true as const };
}
