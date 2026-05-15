import { adminClient } from "@/lib/supabase/admin";

// No input schema — same shape as get_setup_guide.
export const listConnectorsInputSchema = {} as const;

export type ListConnectorsInput = Record<string, never>;

export async function listConnectors(userId: string) {
  const sb = adminClient();
  const sinceIso = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [w30, m30, wAll, mAll] = await Promise.all([
    sb
      .from("workouts")
      .select("source, created_at")
      .eq("user_id", userId)
      .gte("created_at", sinceIso),
    sb
      .from("meals")
      .select("source, created_at")
      .eq("user_id", userId)
      .gte("created_at", sinceIso),
    sb
      .from("workouts")
      .select("source, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    sb
      .from("meals")
      .select("source, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  for (const r of [w30, m30, wAll, mAll]) {
    if (r.error) throw new Error(`list_connectors: ${r.error.message}`);
  }

  type RawRow = { source: string; created_at: string };
  const grouped = new Map<string, { records_30d: number; last_write_at: string | null }>();
  const ensure = (s: string) => {
    if (!grouped.has(s)) grouped.set(s, { records_30d: 0, last_write_at: null });
    return grouped.get(s)!;
  };

  for (const row of [...(w30.data ?? []), ...(m30.data ?? [])] as RawRow[]) {
    ensure(row.source).records_30d += 1;
  }
  for (const row of [...(wAll.data ?? []), ...(mAll.data ?? [])] as RawRow[]) {
    const g = ensure(row.source);
    if (!g.last_write_at || row.created_at > g.last_write_at) {
      g.last_write_at = row.created_at;
    }
  }

  const connectors = Array.from(grouped.entries())
    .map(([source, info]) => {
      const ageMs = info.last_write_at
        ? Date.now() - new Date(info.last_write_at).getTime()
        : null;
      const status =
        ageMs == null
          ? "unknown"
          : ageMs < 2 * 86_400_000
            ? "fresh"
            : ageMs < 7 * 86_400_000
              ? "stale"
              : "down";
      return {
        source,
        records_30d: info.records_30d,
        last_write_at: info.last_write_at,
        status,
      };
    })
    .sort((a, b) => {
      if (!a.last_write_at) return 1;
      if (!b.last_write_at) return -1;
      return a.last_write_at < b.last_write_at ? 1 : -1;
    });

  return { connectors };
}
