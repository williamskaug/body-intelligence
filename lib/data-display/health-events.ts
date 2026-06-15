// Helpers for rendering health events as threads.
//
// Until the one-time conversational migration moves the legacy
// "STATUS <DATE>: ..." appends out of health_events.notes and into
// health_event_updates rows, the UI splits the blob client-side so the
// Apr 27 injury reads as a thread instead of a 5,000-character wall.

export type HealthEventUpdate = {
  date: string;
  note: string;
  severity_at_time: number | null;
};

export type ThreadedHealthEvent = {
  id: string;
  date: string;
  kind: string;
  body_part: string | null;
  severity: number | null;
  notes: string | null;
  resolved_date: string | null;
  next_milestone: string | null;
  next_milestone_date: string | null;
  updates: HealthEventUpdate[];
};

const STATUS_SPLIT = /(?=STATUS\s+[A-Z]{3,9}\.?\s*\d)/;

export type LegacyThread = {
  summary: string;
  updates: Array<{ label: string; note: string }>;
};

/**
 * Split a legacy notes blob into summary + pseudo-updates on the
 * "STATUS <MONTH> <DAY>" markers the dawn-agent used to append. Returns
 * null when the notes don't follow that pattern (plain notes stay plain).
 */
export function splitLegacyStatusNotes(notes: string): LegacyThread | null {
  if (!/STATUS\s+[A-Z]{3,9}\.?\s*\d/.test(notes)) return null;
  const parts = notes.split(STATUS_SPLIT);
  if (parts.length < 2) return null;
  const summary = parts[0]!.trim();
  const updates = parts.slice(1).map((chunk) => {
    const trimmed = chunk.trim();
    const m = /^STATUS\s+([^:—-]{3,40}?)\s*[:—-]\s*([\s\S]*)$/.exec(trimmed);
    if (m) return { label: m[1]!.trim(), note: m[2]!.trim() };
    return { label: "STATUS", note: trimmed.replace(/^STATUS\s*/, "") };
  });
  return { summary, updates };
}

/**
 * The thread to render for an event: real health_event_updates rows when
 * they exist, otherwise the legacy split, otherwise null.
 */
export function eventThread(event: ThreadedHealthEvent): {
  summary: string | null;
  updates: Array<{ label: string; note: string; severity?: number | null }>;
} {
  if (event.updates.length > 0) {
    return {
      summary: event.notes,
      updates: [...event.updates]
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((u) => ({ label: u.date, note: u.note, severity: u.severity_at_time })),
    };
  }
  const legacy = event.notes ? splitLegacyStatusNotes(event.notes) : null;
  if (legacy) {
    return {
      summary: legacy.summary,
      updates: [...legacy.updates].reverse().map((u) => ({ label: u.label, note: u.note })),
    };
  }
  return { summary: event.notes, updates: [] };
}

export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000);
}
