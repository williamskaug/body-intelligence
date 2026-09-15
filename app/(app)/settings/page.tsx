import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageChrome } from "@/components/app/page-chrome";
import { loadTimezone, requireUser } from "@/lib/app/snapshot";
import { localDateInTz } from "@/lib/app/dates";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { recipes } from "@/lib/agents/recipe-data";
import {
  computeSourceStatus,
  sourceDef,
  STATUS_TONE,
  type SourceStatus,
} from "@/lib/data-display/source-registry";
import { InstallRecipeButton } from "../agents/install-button";
import { McpUrl } from "./mcp-url";
import { ProfileForm } from "./profile-form";
import { RevokeClientButton } from "./revoke-button";

export const dynamic = "force-dynamic";

type ConnectedApp = {
  client_id: string;
  name: string;
  redirect_uris: string[];
  active_tokens: number;
  last_used_at: string | null;
  earliest_issued_at: string;
};

export default async function SettingsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const timezone = await loadTimezone(user.id);
  const todayDate = localDateInTz(new Date(), timezone);
  const supabase = await createClient();
  const profileRes = await supabase
    .from("user_profiles")
    .select("display_name, timezone, units_system, locale")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileRes.data;

  const apps = await loadConnectedApps(user.id);
  const dataSources = await loadDataSources(user.id);
  const onboarding = recipes.find((r) => r.id === "onboarding");
  const mcpUrl = await resolveMcpUrl();

  return (
    <PageChrome
      todayDate={todayDate}
      action={{ label: "Save profile", form: "profile-form", type: "submit" }}
    >
      <div className="grid min-w-0 gap-px bg-neutral-200 @5xl:grid-cols-2">
        <section className="bg-white p-4">
          <h2 className="text-[13px] font-semibold">MCP endpoint</h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            Add in Cowork → Connectors. OAuth 2.1 + DCR, no API keys.
          </p>
          <div className="mt-3">
            <McpUrl url={mcpUrl} />
          </div>
        </section>

        <section className="bg-white p-4">
          <h2 className="text-[13px] font-semibold">Profile</h2>
          <ProfileForm
            email={user.email}
            defaults={{
              display_name: profile?.display_name ?? "",
              timezone: profile?.timezone ?? "",
              units_system:
                profile?.units_system === "imperial" ? "imperial" : "metric",
              locale: profile?.locale ?? "",
            }}
          />
        </section>

        <section className="bg-white p-4">
          <h2 className="text-[13px] font-semibold">Connected applications</h2>
          {apps.length === 0 ? (
            <p className="mt-3 text-[12px] text-neutral-500">No applications yet. Add the MCP URL to Cowork.</p>
          ) : (
            <ul className="mt-2 divide-y divide-neutral-100">
              {apps.map((app) => (
                <li key={app.client_id} className="flex items-center justify-between gap-3 py-2 text-[12px]">
                  <div>
                    <p className="font-medium">{app.name}</p>
                    <p className="font-mono text-[11px] text-neutral-500">
                      issued {app.earliest_issued_at.slice(0, 10)}
                      {app.last_used_at ? ` · refreshed ${timeAgo(app.last_used_at)}` : ""}
                    </p>
                  </div>
                  <RevokeClientButton clientId={app.client_id} clientName={app.name} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white p-4">
          <h2 className="text-[13px] font-semibold">Data sources</h2>
          {dataSources.length === 0 ? (
            <p className="mt-3 text-[12px] text-neutral-500">
              No connector writes yet. Install Garmin or Strava from{" "}
              <a href="/agents" className="underline">
                Agents
              </a>
              .
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-neutral-100">
              {dataSources.map((src) => {
                const tone = STATUS_TONE[src.status];
                return (
                  <li key={src.source} className="flex items-center justify-between gap-3 py-2 text-[12px]">
                    <span className="font-medium">{src.label}</span>
                    <span className="flex items-center gap-2">
                      <span
                        className={`border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone.classes}`}
                      >
                        {src.status === "fresh" ? "active" : tone.label}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-500">
                        {src.last_write_at ? `last write ${timeAgo(src.last_write_at)}` : "no writes in 90 d"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bg-white p-4 @5xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-semibold">Browser session</h2>
              <p className="mt-1 text-[12px] text-neutral-500">
                Connected applications keep MCP access until you revoke them.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onboarding ? <InstallRecipeButton recipe={onboarding} compact /> : null}
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="border border-neutral-300 px-2 py-1 text-[11px] hover:bg-neutral-50"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </PageChrome>
  );
}


async function resolveMcpUrl(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${proto}://${host}/api/mcp`;
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/mcp`;
}

async function loadConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const sb = adminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("oauth_tokens")
    .select(
      "client_id, last_used_at, created_at, refresh_expires_at, revoked_at, oauth_clients(name, redirect_uris)",
    )
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("refresh_expires_at", nowIso);
  if (error) throw new Error(`loadConnectedApps: ${error.message}`);

  const grouped = new Map<string, ConnectedApp>();
  for (const row of data ?? []) {
    type Row = {
      client_id: string;
      last_used_at: string | null;
      created_at: string;
      oauth_clients: { name: string; redirect_uris: string[] } | null;
    };
    const r = row as unknown as Row;
    const client = r.oauth_clients;
    if (!client) continue;
    const existing = grouped.get(r.client_id);
    if (existing) {
      existing.active_tokens += 1;
      if (r.last_used_at && (!existing.last_used_at || r.last_used_at > existing.last_used_at)) {
        existing.last_used_at = r.last_used_at;
      }
      if (r.created_at < existing.earliest_issued_at) {
        existing.earliest_issued_at = r.created_at;
      }
    } else {
      grouped.set(r.client_id, {
        client_id: r.client_id,
        name: client.name,
        redirect_uris: client.redirect_uris,
        active_tokens: 1,
        last_used_at: r.last_used_at,
        earliest_issued_at: r.created_at,
      });
    }
  }
  return [...grouped.values()].sort((a, b) =>
    a.earliest_issued_at < b.earliest_issued_at ? 1 : -1,
  );
}

type DataSource = {
  source: string;
  label: string;
  last_write_at: string | null;
  records_30d: number;
  status: SourceStatus;
  note: string | null;
};

async function loadDataSources(userId: string): Promise<DataSource[]> {
  const sb = adminClient();
  const sinceIso = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const todayIso = new Date().toISOString().slice(0, 10);

  // workouts contribute (source, max(created_at), count). Recipe runs
  // provide the heartbeat. daily_entries has no source column today.
  const [workoutRows, allWorkoutRows, runs] = await Promise.all([
    sb.from("workouts").select("source, created_at").eq("user_id", userId).gte("created_at", sinceIso),
    sb
      .from("workouts")
      .select("source, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    sb
      .from("installed_recipes")
      .select("recipe_id, last_run_at, last_run_status")
      .eq("user_id", userId),
  ]);
  if (workoutRows.error) throw new Error(`loadDataSources workouts: ${workoutRows.error.message}`);
  if (allWorkoutRows.error) return [];

  const heartbeatRecipes = new Set(
    ((runs.data ?? []) as Array<{
      recipe_id: string;
      last_run_at: string | null;
      last_run_status: string | null;
    }>)
      .filter(
        (r) =>
          r.last_run_status === "ok" &&
          r.last_run_at != null &&
          r.last_run_at.slice(0, 10) === todayIso,
      )
      .map((r) => r.recipe_id),
  );

  type RawRow = { source: string; created_at: string };
  const grouped = new Map<string, { records_30d: number; last_write_at: string | null }>();
  const ensure = (source: string) => {
    if (!grouped.has(source)) grouped.set(source, { records_30d: 0, last_write_at: null });
    return grouped.get(source)!;
  };

  for (const row of (workoutRows.data ?? []) as RawRow[]) {
    ensure(row.source).records_30d += 1;
  }
  for (const row of (allWorkoutRows.data ?? []) as RawRow[]) {
    const g = ensure(row.source);
    if (!g.last_write_at || row.created_at > g.last_write_at) g.last_write_at = row.created_at;
  }

  const order: Record<SourceStatus, number> = {
    down: 0,
    stale: 1,
    fresh: 2,
    idle: 3,
    manual: 4,
    retired: 5,
    unknown: 6,
  };
  return Array.from(grouped.entries())
    .map(([source, info]) => {
      const def = sourceDef(source);
      const heartbeatOkToday = (def.heartbeatRecipes ?? []).some((r) =>
        heartbeatRecipes.has(r),
      );
      return {
        source,
        label: def.label,
        last_write_at: info.last_write_at,
        records_30d: info.records_30d,
        status: computeSourceStatus(def, info.last_write_at, heartbeatOkToday),
        note: def.note ?? null,
      };
    })
    .sort((a, b) => order[a.status] - order[b.status]);
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}
