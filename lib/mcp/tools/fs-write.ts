import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { documentPath } from "./shared";

export const fsWriteInputSchema = {
  path: documentPath,
  content: z.string().max(1_000_000),
};

export type FsWriteInput = { path: string; content: string };

export async function fsWrite(userId: string, input: FsWriteInput) {
  const sb = adminClient();

  const existing = await sb
    .from("documents")
    .select("id")
    .eq("user_id", userId)
    .eq("path", input.path)
    .maybeSingle();
  if (existing.error) throw new Error(`fs_write lookup: ${existing.error.message}`);

  const updatedAt = new Date().toISOString();

  if (existing.data) {
    const { data, error } = await sb
      .from("documents")
      .update({ content: input.content, updated_at: updatedAt })
      .eq("id", existing.data.id)
      .select("path, content, updated_at")
      .single();
    if (error) throw new Error(`fs_write update: ${error.message}`);
    return data;
  }

  const { data, error } = await sb
    .from("documents")
    .insert({
      user_id: userId,
      path: input.path,
      content: input.content,
    })
    .select("path, content, updated_at")
    .single();
  if (error) throw new Error(`fs_write insert: ${error.message}`);
  return data;
}
