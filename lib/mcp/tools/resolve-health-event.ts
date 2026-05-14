import { z } from "zod";
import { updateHealthEvent } from "./update-health-event";
import { dateString } from "./shared";

export const resolveHealthEventInputSchema = {
  id: z.string().uuid(),
  resolved_date: dateString.optional().describe(
    "The date the issue cleared (YYYY-MM-DD). Defaults to today (server clock) if omitted.",
  ),
};

export type ResolveHealthEventInput = {
  id: string;
  resolved_date?: string;
};

export async function resolveHealthEvent(
  userId: string,
  input: ResolveHealthEventInput,
) {
  const date = input.resolved_date ?? new Date().toISOString().slice(0, 10);
  return updateHealthEvent(userId, { id: input.id, resolved_date: date });
}
