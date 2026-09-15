/** Calendar-date helpers used by the authenticated app shell. */

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Local calendar date (YYYY-MM-DD) for an instant in a given IANA timezone. */
export function localDateInTz(instant: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

export function formatHeaderDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(d)
    .toUpperCase();
}

export function isoWeek(date: string): { year: number; week: number; label: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { year, week, label: `W${week}` };
}

export function weekdayShort(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()] ?? "";
}

export function formatDayMonth(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

export function daysBetween(a: string, b: string): number {
  const aa = new Date(`${a}T00:00:00Z`).getTime();
  const bb = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((bb - aa) / 86_400_000);
}

export function isMissingRelation(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST205") {
    return true;
  }
  const m = error.message ?? "";
  return /does not exist|schema cache/i.test(m);
}
