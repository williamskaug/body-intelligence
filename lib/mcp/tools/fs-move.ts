import { adminClient } from "@/lib/supabase/admin";
import { documentPath } from "./shared";

export const fsMoveInputSchema = {
  from_path: documentPath,
  to_path: documentPath,
};

export type FsMoveInput = { from_path: string; to_path: string };

/**
 * Rename or relocate a memory document atomically.
 *
 * Both paths must be unique within the user's filesystem. Throws if `from_path`
 * doesn't exist, or if `to_path` is already taken (use fs_delete + fs_move,
 * or fs_write + fs_delete, when intentionally overwriting). No-op renames
 * (from === to) succeed without touching the row.
 */
export async function fsMove(userId: string, input: FsMoveInput) {
  if (input.from_path === input.to_path) {
    const existing = await adminClient()
      .from("documents")
      .select("path, updated_at")
      .eq("user_id", userId)
      .eq("path", input.from_path)
      .maybeSingle();
    if (existing.error) throw new Error(`fs_move: ${existing.error.message}`);
    if (!existing.data)
      throw new Error(`fs_move: source ${input.from_path} not found`);
    return { ...existing.data, moved: false as const };
  }

  const sb = adminClient();

  const conflict = await sb
    .from("documents")
    .select("id")
    .eq("user_id", userId)
    .eq("path", input.to_path)
    .maybeSingle();
  if (conflict.error) throw new Error(`fs_move: ${conflict.error.message}`);
  if (conflict.data)
    throw new Error(
      `fs_move: destination ${input.to_path} already exists — delete it first or pick another path`,
    );

  const { data, error } = await sb
    .from("documents")
    .update({ path: input.to_path, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("path", input.from_path)
    .select("path, updated_at")
    .maybeSingle();
  if (error) throw new Error(`fs_move: ${error.message}`);
  if (!data) throw new Error(`fs_move: source ${input.from_path} not found`);
  return { ...data, moved: true as const };
}
