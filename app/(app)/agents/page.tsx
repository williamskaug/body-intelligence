import { PageChrome } from "@/components/app/page-chrome";
import { AgentsView, type CaptureGap, type InstallState } from "@/components/agents/agents-view";
import { parseRecipeDoc, type UserRecipeDoc } from "@/lib/agents/recipe-doc";
import { addDays } from "@/lib/app/dates";
import { num } from "@/lib/app/format";
import { loadAppSnapshot, requireUser, type AppSnapshot } from "@/lib/app/snapshot";
import { parseWindow } from "@/lib/app/window";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const user = await requireUser();
  if (!user) return null;
  const snapshot = await loadAppSnapshot(user.id, user.email, parseWindow({}));
  const [installState, userDocs, capture] = await Promise.all([
    loadInstallState(user.id),
    loadUserRecipeDocs(user.id),
    loadCaptureGaps(snapshot, user.id),
  ]);

  return (
    <PageChrome
      snapshot={snapshot}
      action={{ label: "+ Install recipe", href: "/agents#recipe-library" }}
    >
      <AgentsView installState={installState} userDocs={userDocs} capture={capture} />
    </PageChrome>
  );
}

async function loadUserRecipeDocs(userId: string): Promise<UserRecipeDoc[]> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("documents")
    .select("path, content")
    .eq("user_id", userId)
    .like("path", "recipes/%")
    .order("path");
  if (error) return [];
  const out: UserRecipeDoc[] = [];
  for (const row of (data ?? []) as Array<{ path: string; content: string }>) {
    const doc = parseRecipeDoc(row.path, row.content);
    if (doc) out.push(doc);
  }
  return out;
}

async function loadCaptureGaps(snapshot: AppSnapshot, userId: string): Promise<CaptureGap> {
  const todayDate = snapshot.todayDate;
  const daily = snapshot.dailyHistory;
  const lastWeight = daily.find((d) => num(d.weight_kg) != null);
  const since14 = addDays(todayDate, -13);
  const notesDays = daily.filter(
    (d) => d.date >= since14 && Boolean(d.wellness_notes?.trim() || d.sleep_notes?.trim()),
  ).length;
  const sb = adminClient();
  const since30 = addDays(todayDate, -29);
  const since60 = addDays(todayDate, -59);
  const head = { count: "exact" as const, head: true };
  const [w, z, c] = await Promise.all([
    sb.from("workouts").select("id", head).eq("user_id", userId).gte("date", since30),
    sb.from("workout_zones").select("workout_id", head).eq("user_id", userId).gte("date", since30),
    sb.from("capacity_metrics").select("id", head).eq("user_id", userId).gte("date", since60),
  ]);
  const missing: string[] = [];
  if ((w.count ?? 0) > 0) {
    if ((z.count ?? 0) === 0) missing.push("HR zones");
    if ((c.count ?? 0) === 0) missing.push("capacity");
  }
  return {
    weightDaysAgo: lastWeight
      ? Math.round(
          (Date.parse(`${todayDate}T00:00:00Z`) - Date.parse(`${lastWeight.date}T00:00:00Z`)) /
            86_400_000,
        )
      : null,
    notesDays,
    missing,
  };
}

async function loadInstallState(userId: string): Promise<Map<string, InstallState>> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("installed_recipes")
    .select("recipe_id, installed_at, last_run_at, last_run_status, run_count, last_error")
    .eq("user_id", userId);
  if (error) return new Map();
  const out = new Map<string, InstallState>();
  for (const row of (data ?? []) as Array<{ recipe_id: string } & InstallState>) {
    out.set(row.recipe_id, row);
  }
  return out;
}
