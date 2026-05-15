import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

const STREAK_KINDS = ["daily_entry", "meal_logged", "workout"] as const;

export const getStreakInputSchema = {
  kind: z.enum(STREAK_KINDS).describe(
    "Which habit to measure. 'meal_logged' counts a day with ≥3 meals logged.",
  ),
};

export type GetStreakInput = {
  kind: (typeof STREAK_KINDS)[number];
};

// Look back 365 days for best-streak history; sparkline shows the last 30.
const LOOKBACK_DAYS = 365;
const SPARKLINE_LEN = 30;

export async function getStreak(userId: string, input: GetStreakInput) {
  const sb = adminClient();

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const earliest = new Date(today);
  earliest.setUTCDate(earliest.getUTCDate() - LOOKBACK_DAYS);
  const earliestIso = earliest.toISOString().slice(0, 10);

  const filledDays = new Set<string>();

  if (input.kind === "daily_entry") {
    const { data, error } = await sb
      .from("daily_entries")
      .select("date")
      .eq("user_id", userId)
      .gte("date", earliestIso);
    if (error) throw new Error(`get_streak daily: ${error.message}`);
    for (const row of (data ?? []) as Array<{ date: string }>) {
      filledDays.add(row.date);
    }
  } else if (input.kind === "workout") {
    const { data, error } = await sb
      .from("workouts")
      .select("date")
      .eq("user_id", userId)
      .gte("date", earliestIso);
    if (error) throw new Error(`get_streak workout: ${error.message}`);
    for (const row of (data ?? []) as Array<{ date: string }>) {
      filledDays.add(row.date);
    }
  } else if (input.kind === "meal_logged") {
    const { data, error } = await sb
      .from("meals")
      .select("eaten_at")
      .eq("user_id", userId)
      .gte("eaten_at", `${earliestIso}T00:00:00Z`);
    if (error) throw new Error(`get_streak meal: ${error.message}`);
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ eaten_at: string }>) {
      const day = row.eaten_at.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    for (const [day, n] of counts) if (n >= 3) filledDays.add(day);
  }

  // Build the contiguous date axis ending today.
  const days: string[] = [];
  const cursor = new Date(`${todayIso}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - LOOKBACK_DAYS);
  for (let i = 0; i <= LOOKBACK_DAYS; i++) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // current_streak: count days back from today (inclusive) until first miss.
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (filledDays.has(days[i]!)) current++;
    else break;
  }

  // best_streak: longest consecutive run anywhere in the window.
  let best = 0;
  let run = 0;
  for (const d of days) {
    if (filledDays.has(d)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  const sparkline = days.slice(-SPARKLINE_LEN).map((d) => filledDays.has(d));

  return {
    kind: input.kind,
    current_streak_days: current,
    best_streak_days: best,
    sparkline,
    computed_as_of: todayIso,
  };
}
