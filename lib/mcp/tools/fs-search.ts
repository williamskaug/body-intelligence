import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const fsSearchInputSchema = {
  query: z.string().trim().min(1).max(1000),
  limit: z.number().int().min(1).max(100).default(20),
};

export type FsSearchInput = { query: string; limit?: number };

const SNIPPET_RADIUS = 100;

export async function fsSearch(userId: string, input: FsSearchInput) {
  const sb = adminClient();
  const limit = input.limit ?? 20;

  // Use websearch_to_tsquery via textSearch helper. The GIN index on
  // to_tsvector('english', content) backs this.
  const { data, error } = await sb
    .from("documents")
    .select("path, content, updated_at")
    .eq("user_id", userId)
    .textSearch("content", input.query, {
      type: "websearch",
      config: "english",
    })
    .limit(limit);
  if (error) throw new Error(`fs_search: ${error.message}`);

  return (data ?? []).map((row) => ({
    path: row.path,
    snippet: makeSnippet(row.content, input.query),
    updated_at: row.updated_at,
  }));
}

function makeSnippet(content: string, query: string): string {
  const lower = content.toLowerCase();
  const firstWord = query.toLowerCase().split(/\s+/)[0] ?? "";
  const idx = firstWord ? lower.indexOf(firstWord) : -1;
  if (idx < 0) return content.slice(0, SNIPPET_RADIUS * 2);
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(content.length, idx + firstWord.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < content.length ? "…" : "";
  return prefix + content.slice(start, end) + suffix;
}
