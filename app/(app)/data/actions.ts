"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fsWrite } from "@/lib/mcp/tools/fs-write";
import { logDaily, type LogDailyInput } from "@/lib/mcp/tools/log-daily";
import { documentPath, wellnessScale, dateString } from "@/lib/mcp/tools/shared";

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
  revalidatePath("/data");
  return { ok: true as const };
}

const wellnessFormSchema = z.object({
  date: dateString,
  fatigue: wellnessScale.optional(),
  soreness: wellnessScale.optional(),
  mood: wellnessScale.optional(),
  stress: wellnessScale.optional(),
  motivation: wellnessScale.optional(),
  sleep_quality: wellnessScale.optional(),
  sleep_h: z.number().min(0).max(24).optional(),
  hrv_ms: z.number().int().min(0).max(500).optional(),
  rhr_bpm: z.number().int().min(20).max(200).optional(),
  sleep_notes: z.string().max(10_000).optional(),
  wellness_notes: z.string().max(10_000).optional(),
});

export async function saveWellnessEntry(input: LogDailyInput) {
  const parsed = wellnessFormSchema.parse(input);
  const userId = await authedUserId();
  await logDaily(userId, parsed);
  revalidatePath("/data");
  return { ok: true as const };
}
