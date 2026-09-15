import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";

export const getCalendarInputSchema = {
  year: z.number().int().min(2000).max(2100),
  month: z
    .number()
    .int()
    .min(1)
    .max(12)
    .describe("1 = January through 12 = December."),
};

export type GetCalendarInput = { year: number; month: number };

export async function getCalendar(userId: string, input: GetCalendarInput) {
  const sb = adminClient();
  const yyyy = input.year;
  const mm = input.month;
  const firstDay = `${yyyy}-${String(mm).padStart(2, "0")}-01`;
  const lastDayDt = new Date(Date.UTC(yyyy, mm, 0));
  const lastDay = lastDayDt.toISOString().slice(0, 10);

  const [workoutRes, dailyRes, eventRes] = await Promise.all([
    sb
      .from("workouts")
      .select("date, type, duration_min")
      .eq("user_id", userId)
      .gte("date", firstDay)
      .lte("date", lastDay),
    sb
      .from("daily_entries")
      .select("date")
      .eq("user_id", userId)
      .gte("date", firstDay)
      .lte("date", lastDay),
    sb
      .from("health_events")
      .select("date, resolved_date")
      .eq("user_id", userId)
      .lte("date", lastDay),
  ]);

  for (const r of [workoutRes, dailyRes, eventRes]) {
    if (r.error) throw new Error(`get_calendar: ${r.error.message}`);
  }

  type WorkoutAgg = { count: number; total_min: number; types: Set<string> };
  const workoutsByDate = new Map<string, WorkoutAgg>();
  for (const row of (workoutRes.data ?? []) as Array<{
    date: string;
    type: string;
    duration_min: number | null;
  }>) {
    const agg = workoutsByDate.get(row.date) ?? {
      count: 0,
      total_min: 0,
      types: new Set<string>(),
    };
    agg.count += 1;
    agg.total_min += row.duration_min ?? 0;
    agg.types.add(row.type.trim().toLowerCase());
    workoutsByDate.set(row.date, agg);
  }

  const dailyDates = new Set(
    ((dailyRes.data ?? []) as Array<{ date: string }>).map((d) => d.date),
  );

  // For health events, count those still active on each day (date ≤ day, resolved_date null OR > day).
  const events = (eventRes.data ?? []) as Array<{
    date: string;
    resolved_date: string | null;
  }>;

  const days: Array<{
    date: string;
    workout_count: number;
    workout_total_min: number;
    workout_types: string[];
    has_daily_entry: boolean;
    active_health_event_count: number;
  }> = [];

  const lastNum = lastDayDt.getUTCDate();
  for (let d = 1; d <= lastNum; d++) {
    const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const w = workoutsByDate.get(iso);
    const activeEvents = events.filter(
      (e) => e.date <= iso && (!e.resolved_date || e.resolved_date > iso),
    ).length;
    days.push({
      date: iso,
      workout_count: w?.count ?? 0,
      workout_total_min: w?.total_min ?? 0,
      workout_types: w ? Array.from(w.types) : [],
      has_daily_entry: dailyDates.has(iso),
      active_health_event_count: activeEvents,
    });
  }

  return { year: yyyy, month: mm, days };
}
