import { z } from "zod";
import { updateHealthEvent } from "./update-health-event";
import { addHealthEventUpdate } from "./add-health-event-update";
import { dateString } from "./shared";

export const resolveHealthEventInputSchema = {
  id: z.string().uuid(),
  resolved_date: dateString.optional().describe(
    "The date the issue cleared (YYYY-MM-DD). Defaults to today (server clock) if omitted.",
  ),
  note: z
    .string()
    .max(5000)
    .optional()
    .describe(
      "Optional closing thread entry — what cleared it, the resolution gate that was met, lessons. Recorded via add_health_event_update on the resolved date.",
    ),
};

export type ResolveHealthEventInput = {
  id: string;
  resolved_date?: string;
  note?: string;
};

export async function resolveHealthEvent(
  userId: string,
  input: ResolveHealthEventInput,
) {
  const date = input.resolved_date ?? new Date().toISOString().slice(0, 10);
  if (input.note) {
    await addHealthEventUpdate(userId, {
      event_id: input.id,
      date,
      note: input.note,
      on_same_date: "append",
    });
  }
  return updateHealthEvent(userId, { id: input.id, resolved_date: date });
}
