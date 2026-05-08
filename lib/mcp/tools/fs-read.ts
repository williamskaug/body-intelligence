import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const fsReadInputSchema = {
  path: z
    .string()
    .min(1)
    .max(255)
    .describe("Document path, e.g. 'PROFILE.md' or 'CURRENT.md'"),
};

export async function fsRead(
  userId: string,
  input: { path: string },
): Promise<string> {
  const { data, error } = await adminClient()
    .from("documents")
    .select("content")
    .eq("user_id", userId)
    .eq("path", input.path)
    .maybeSingle();
  if (error) throw new Error(`fs_read: ${error.message}`);
  if (!data) throw new Error(`Document not found: ${input.path}`);
  return data.content;
}
