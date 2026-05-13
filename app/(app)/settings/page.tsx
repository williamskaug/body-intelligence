import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { recipes } from "@/lib/agents/recipe-data";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profileRes = await supabase
    .from("user_profiles")
    .select("display_name, timezone, units_system, locale")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileRes.data;

  const apps = await loadConnectedApps(user.id);
  const onboarding = recipes.find((r) => r.id === "onboarding");
  const mcpUrl = await resolveMcpUrl();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Profile, MCP endpoint, connected applications, and account
          maintenance.
        </p>
      </header>

      <div className="space-y-6">
        <section
          aria-labelledby="mcp-heading"
          className="rounded-2xl border bg-gradient-to-br from-card to-card/60 p-6 shadow-sm ring-1 ring-foreground/[0.03]"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="mcp-heading" className="text-base font-semibold tracking-tight">
              MCP endpoint
            </h2>
            <Badge variant="outline" className="font-mono text-[10px]">
              OAuth 2.1 · DCR
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Add this URL to Cowork (or any MCP-compatible Claude client). The
            first connection runs OAuth — approve once and Claude has scoped
            read/write access to your data.
          </p>
          <div className="mt-4">
            <McpUrl url={mcpUrl} />
          </div>
        </section>

        <section
          aria-labelledby="profile-heading"
          className="rounded-2xl border bg-card p-6 shadow-sm"
        >
          <h2 id="profile-heading" className="text-base font-semibold tracking-tight">
            Profile
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Used by capture recipes for date boundaries and unit conversion.
            Reasoning recipes pull deeper context from{" "}
            <span className="font-mono">PROFILE.md</span>.
          </p>
          <ProfileForm
            email={user.email ?? ""}
            defaults={{
              display_name: profile?.display_name ?? "",
              timezone: profile?.timezone ?? "",
              units_system:
                (profile?.units_system === "imperial" ? "imperial" : "metric") as
                  | "metric"
                  | "imperial",
              locale: profile?.locale ?? "",
            }}
          />
        </section>

        <section
          aria-labelledby="apps-heading"
          className="rounded-2xl border bg-card p-6 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="apps-heading" className="text-base font-semibold tracking-tight">
              Connected applications
            </h2>
            <Badge variant="outline">{apps.length}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            MCP clients (typically a Cowork install) that hold an active access
            token to your data.
          </p>

          {apps.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No applications yet</p>
              <p className="mt-1">
                Add the MCP URL above to Cowork to authorize one. New tokens
                will appear here automatically.
              </p>
            </div>
          ) : (
            <ul className="mt-6 divide-y">
              {apps.map((app) => (
                <li
                  key={app.client_id}
                  className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{app.name}</p>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {app.client_id}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {app.active_tokens} active token
                      {app.active_tokens === 1 ? "" : "s"}
                      {" · "}
                      issued {timeAgo(app.earliest_issued_at)}
                      {app.last_used_at
                        ? ` · last used ${timeAgo(app.last_used_at)}`
                        : " · never used"}
                    </p>
                  </div>
                  <RevokeClientButton clientId={app.client_id} clientName={app.name} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="onboarding-heading"
          className="rounded-2xl border border-dashed bg-card/40 p-5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="onboarding-heading"
              className="text-sm font-semibold tracking-tight"
            >
              Re-run onboarding
            </h2>
            {onboarding ? <InstallRecipeButton recipe={onboarding} /> : null}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Walk through PROFILE.md, GOALS.md, and PRINCIPLES.md so your future
            Claude conversations have real context to reason against.{" "}
            <a href="/agents" className="underline underline-offset-4 hover:text-foreground">
              Browse all recipes →
            </a>
          </p>
        </section>

        <section
          aria-labelledby="session-heading"
          className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2
              id="session-heading"
              className="text-sm font-medium tracking-tight"
            >
              Browser session
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Connected applications above continue to have MCP access until you
              revoke them.
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Sign out of this browser
            </Button>
          </form>
        </section>
      </div>
    </div>
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
