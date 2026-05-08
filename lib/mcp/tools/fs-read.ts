import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const fsReadInputSchema = {
  path: z
    .string()
    .min(1)
    .max(255)
    .describe("Document path, e.g. 'PROFILE.md' or 'CURRENT.md'"),
};

export type FsReadResult = {
  path: string;
  content: string;
  updated_at: string;
} | null;

export async function fsRead(
  userId: string,
  input: { path: string },
): Promise<FsReadResult> {
  const { data, error } = await adminClient()
    .from("documents")
    .select("path, content, updated_at")
    .eq("user_id", userId)
    .eq("path", input.path)
    .maybeSingle();
  if (error) throw new Error(`fs_read: ${error.message}`);
  if (!data) return null;
  return data;
}
