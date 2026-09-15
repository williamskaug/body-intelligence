"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fsWrite } from "@/lib/mcp/tools/fs-write";
import { logDaily, type LogDailyInput } from "@/lib/mcp/tools/log-daily";
import { logWorkout } from "@/lib/mcp/tools/log-workout";
import { logHealthEvent } from "@/lib/mcp/tools/log-health-event";
import { addHealthEventUpdate } from "@/lib/mcp/tools/add-health-event-update";
import { resolveHealthEvent } from "@/lib/mcp/tools/resolve-health-event";
import { updateHealthEvent } from "@/lib/mcp/tools/update-health-event";
import { searchEverything } from "@/lib/mcp/tools/search-everything";
import { documentPath, dateString } from "@/lib/mcp/tools/shared";
import { revalidateApp } from "@/lib/app/revalidate";

async function authedUserId(): Promise<string> {
  const sb = await createClient();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new Error("not authenticated");
  return data.user.id;
}

const saveMemoryDocSchema = z.object({
  path: documentPath,
  content: z.string().max(1_000_000),
});

export async function saveMemoryDoc(input: { path: string; content: string }) {
  const parsed = saveMemoryDocSchema.parse(input);
  const userId = await authedUserId();
  await fsWrite(userId, parsed);
  revalidateApp(userId);
  return { ok: true as const };
}

const wellnessFormSchema = z.object({
  date: dateString,
  sleep_h: z.number().min(0).max(24).optional(),
  hrv_ms: z.number().int().min(0).max(500).optional(),
  rhr_bpm: z.number().int().min(20).max(200).optional(),
  sleep_notes: z.string().max(10_000).optional(),
  wellness_notes: z.string().max(10_000).optional(),
  weight_kg: z.number().min(20).max(400).optional(),
});

export async function saveWellnessEntry(input: LogDailyInput) {
  const parsed = wellnessFormSchema.parse(input);
  const userId = await authedUserId();
  await logDaily(userId, parsed);
  revalidateApp(userId);
  return { ok: true as const };
}

const workoutSchema = z.object({
  date: dateString,
  type: z.string().trim().min(1).max(200),
  duration_min: z.number().int().min(0).max(60 * 24).optional(),
  distance_km: z.number().min(0).max(10_000).optional(),
  avg_hr: z.number().int().min(20).max(260).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(10_000).optional(),
});

export async function saveWorkout(input: z.infer<typeof workoutSchema>) {
  const parsed = workoutSchema.parse(input);
  const userId = await authedUserId();
  await logWorkout(userId, { ...parsed, source: "manual" });
  revalidateApp(userId);
  return { ok: true as const };
}

const healthEventSchema = z.object({
  date: dateString,
  kind: z.enum(["injury", "illness", "symptom"]),
  body_part: z.string().trim().max(100).optional(),
  severity: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(10_000).optional(),
});

export async function saveHealthEvent(input: z.infer<typeof healthEventSchema>) {
  const parsed = healthEventSchema.parse(input);
  const userId = await authedUserId();
  await logHealthEvent(userId, parsed);
  revalidateApp(userId);
  return { ok: true as const };
}

const updateSchema = z.object({
  event_id: z.string().uuid(),
  date: dateString,
  note: z.string().min(1).max(5000),
  severity_at_time: z.number().int().min(1).max(5).optional(),
});

export async function saveHealthEventUpdate(input: z.infer<typeof updateSchema>) {
  const parsed = updateSchema.parse(input);
  const userId = await authedUserId();
  await addHealthEventUpdate(userId, parsed);
  revalidateApp(userId);
  return { ok: true as const };
}

export async function closeHealthEvent(input: { id: string; note?: string; resolved_date?: string }) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      note: z.string().max(5000).optional(),
      resolved_date: dateString.optional(),
    })
    .parse(input);
  const userId = await authedUserId();
  await resolveHealthEvent(userId, parsed);
  revalidateApp(userId);
  return { ok: true as const };
}

export async function saveHealthEventMilestone(input: {
  id: string;
  next_milestone: string | null;
  next_milestone_date: string | null;
}) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      next_milestone: z.string().max(200).nullable(),
      next_milestone_date: dateString.nullable(),
    })
    .parse(input);
  const userId = await authedUserId();
  await updateHealthEvent(userId, parsed);
  revalidateApp(userId);
  return { ok: true as const };
}

export type SearchHit = {
  kind: "workout" | "daily_entry" | "health_event" | "document";
  id: string;
  date?: string;
  path?: string;
  snippet: string;
};

export async function searchApp(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const userId = await authedUserId();
  const hits = await searchEverything(userId, { query: q, limit: 12 });
  return hits.map((h) => ({
    kind: h.kind,
    id: h.id,
    date: h.date,
    path: h.path,
    snippet: h.snippet,
  }));
}
