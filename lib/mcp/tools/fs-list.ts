import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { escapeLikePattern } from "./shared";

export const fsListInputSchema = {
  prefix: z
    .string()
    .trim()
    .max(255)
    .optional()
    .describe(
      "Optional path prefix to scope the listing — e.g. 'notes/' returns everything under that folder. Empty / omitted lists the entire filesystem.",
    ),
};

export type FsListInput = { prefix?: string };

type FileEntry = { path: string; updated_at: string };
type FolderEntry = { path: string; file_count: number };

/**
 * List the user's virtual filesystem.
 *
 * Returns BOTH a flat list of files (sorted by path) and a derived folder
 * summary (distinct directory prefixes with file counts). Folders are
 * implicit — they're computed from the paths, not stored as rows. A prefix
 * like 'notes/' restricts the listing to that subtree.
 */
export async function fsList(userId: string, input: FsListInput) {
  const sb = adminClient();
  let query = sb
    .from("documents")
    .select("path, updated_at")
    .eq("user_id", userId);

  if (input.prefix) {
    query = query.like("path", `${escapeLikePattern(input.prefix)}%`);
  }

  const { data, error } = await query.order("path", { ascending: true });
  if (error) throw new Error(`fs_list: ${error.message}`);

  const files: FileEntry[] = data ?? [];

  // Compute distinct folder prefixes from the file paths. A "folder" is any
  // directory containing at least one file — e.g. "notes/2026/" if any file
  // lives under "notes/2026/...". Counts include all nested files.
  const folderCounts = new Map<string, number>();
  for (const f of files) {
    const segments = f.path.split("/");
    // Every prefix except the file's own segment is a folder.
    for (let i = 1; i < segments.length; i++) {
      const folder = segments.slice(0, i).join("/") + "/";
      folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
    }
  }
  const folders: FolderEntry[] = [...folderCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, file_count]) => ({ path, file_count }));

  return { files, folders };
}
