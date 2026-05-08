import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const searchEverythingInputSchema = {
  query: z.string().trim().min(1).max(1000),
  limit: z.number().int().min(1).max(100).default(20),
};

export type SearchEverythingInput = { query: string; limit?: number };

type Hit = {
  kind: "workout" | "daily_entry" | "meal" | "health_event" | "document";
  id: string;
  date?: string;
  path?: string;
  snippet: string;
  updated_at: string;
};

const SNIPPET_RADIUS = 100;

export async function searchEverything(userId: string, input: SearchEverythingInput) {
  const sb = adminClient();
  const limit = input.limit ?? 20;
  const q = input.query;
  const ilikePattern = `%${q}%`;
  const lowerQuery = q.toLowerCase();

  // Documents use the GIN index via full-text search.
  const documentsP = sb
    .from("documents")
    .select("id, path, content, updated_at")
    .eq("user_id", userId)
    .textSearch("content", q, { type: "websearch", config: "english" })
    .limit(limit);

  // Entity tables use ilike against the prose-bearing columns. They're small
  // enough that this is fine for v1.
  const workoutsP = sb
    .from("workouts")
    .select("id, date, type, notes, shoes, updated_at")
    .eq("user_id", userId)
    .or(`type.ilike.${ilikePattern},notes.ilike.${ilikePattern},shoes.ilike.${ilikePattern}`)
    .limit(limit);

  const dailyP = sb
    .from("daily_entries")
    .select("id, date, sleep_notes, wellness_notes, meal_notes, updated_at")
    .eq("user_id", userId)
    .or(
      `sleep_notes.ilike.${ilikePattern},wellness_notes.ilike.${ilikePattern},meal_notes.ilike.${ilikePattern}`,
    )
    .limit(limit);

  const mealsP = sb
    .from("meals")
    .select("id, eaten_at, description, notes, meal_type, updated_at")
    .eq("user_id", userId)
    .or(
      `description.ilike.${ilikePattern},notes.ilike.${ilikePattern},meal_type.ilike.${ilikePattern}`,
    )
    .limit(limit);

  const healthEventsP = sb
    .from("health_events")
    .select("id, date, kind, body_part, notes, updated_at")
    .eq("user_id", userId)
    .or(`body_part.ilike.${ilikePattern},notes.ilike.${ilikePattern},kind.ilike.${ilikePattern}`)
    .limit(limit);

  const [documents, workouts, daily, meals, healthEvents] = await Promise.all([
    documentsP,
    workoutsP,
    dailyP,
    mealsP,
    healthEventsP,
  ]);

  const errors = [
    documents.error && `documents: ${documents.error.message}`,
    workouts.error && `workouts: ${workouts.error.message}`,
    daily.error && `daily_entries: ${daily.error.message}`,
    meals.error && `meals: ${meals.error.message}`,
    healthEvents.error && `health_events: ${healthEvents.error.message}`,
  ].filter(Boolean);
  if (errors.length) throw new Error(`search_everything: ${errors.join("; ")}`);

  const hits: Hit[] = [
    ...(documents.data ?? []).map<Hit>((r) => ({
      kind: "document",
      id: r.id,
      path: r.path,
      snippet: makeSnippet(r.content, lowerQuery),
      updated_at: r.updated_at,
    })),
    ...(workouts.data ?? []).map<Hit>((r) => ({
      kind: "workout",
      id: r.id,
      date: r.date,
      snippet: makeSnippet(`${r.type} — ${r.shoes ?? ""} — ${r.notes ?? ""}`, lowerQuery),
      updated_at: r.updated_at,
    })),
    ...(daily.data ?? []).map<Hit>((r) => ({
      kind: "daily_entry",
      id: r.id,
      date: r.date,
      snippet: makeSnippet(
        [r.sleep_notes, r.wellness_notes, r.meal_notes].filter(Boolean).join(" — "),
        lowerQuery,
      ),
      updated_at: r.updated_at,
    })),
    ...(meals.data ?? []).map<Hit>((r) => ({
      kind: "meal",
      id: r.id,
      date: r.eaten_at,
      snippet: makeSnippet(`${r.description} — ${r.notes ?? ""}`, lowerQuery),
      updated_at: r.updated_at,
    })),
    ...(healthEvents.data ?? []).map<Hit>((r) => ({
      kind: "health_event",
      id: r.id,
      date: r.date,
      snippet: makeSnippet(
        `${r.kind} — ${r.body_part ?? ""} — ${r.notes ?? ""}`,
        lowerQuery,
      ),
      updated_at: r.updated_at,
    })),
  ];

  hits.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  return hits.slice(0, limit);
}

function makeSnippet(haystack: string, lowerQuery: string): string {
  if (!haystack) return "";
  const lower = haystack.toLowerCase();
  const firstWord = lowerQuery.split(/\s+/)[0] ?? "";
  const idx = firstWord ? lower.indexOf(firstWord) : -1;
  if (idx < 0) return haystack.slice(0, SNIPPET_RADIUS * 2);
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(haystack.length, idx + firstWord.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < haystack.length ? "…" : "";
  return prefix + haystack.slice(start, end) + suffix;
}
