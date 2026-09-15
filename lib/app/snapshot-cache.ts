/** Cache tags + DTO helpers for the per-user app snapshot. */

export function userDataTag(userId: string): string {
  return `bi-user-${userId}`;
}

export function snapshotCacheKey(
  userId: string,
  email: string,
  days: number,
  focusRun: boolean,
): string[] {
  return ["app-snapshot", userId, email, String(days), focusRun ? "run" : "all"];
}

export function analyzeExtrasCacheKey(userId: string, days: number, focusRun: boolean): string[] {
  return ["analyze-extras", userId, String(days), focusRun ? "run" : "all"];
}

export function dehydrateContentMap(map: Map<string, string>): Record<string, string> {
  return Object.fromEntries(map);
}

export function hydrateContentMap(record: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(record));
}
