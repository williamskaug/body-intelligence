import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { recipes } from "@/lib/agents/recipe-data";
import { InstallRecipeButton } from "../agents/install-button";
import { revokeClientAction } from "./actions";

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

  // Profile
  const profileRes = await supabase
    .from("user_profiles")
    .select("display_name, timezone, units_system, locale")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileRes.data;

  // Connected applications: tokens grouped by client.
  const apps = await loadConnectedApps(user.id);

  const onboarding = recipes.find((r) => r.id === "onboarding");

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>

      <section className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight">Profile</h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Field label="Email" value={user.email ?? "—"} mono />
          <Field label="Display name" value={profile?.display_name ?? "—"} />
          <Field label="Timezone" value={profile?.timezone ?? "—"} mono />
          <Field
            label="Units"
            value={profile?.units_system === "imperial" ? "Imperial" : "Metric"}
          />
          <Field label="Locale" value={profile?.locale ?? "—"} mono />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Profile editing is coming. For now, ask Claude to update PROFILE.md
          via fs_write — that file is what your reasoning recipes actually use.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">
            Connected applications
          </h2>
          <Badge variant="outline">{apps.length}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          MCP clients (typically a Cowork install) that hold an active access
          token to your data.
        </p>

        {apps.length === 0 ? (
          <p className="mt-6 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            No connected applications yet. Add the BI MCP URL to Cowork to
            authorize one.
          </p>
        ) : (
          <ul className="mt-6 divide-y">
            {apps.map((app) => (
              <li key={app.client_id} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{app.name}</p>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {app.client_id}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {app.active_tokens} active token{app.active_tokens === 1 ? "" : "s"}
                    {" · "}
                    issued {timeAgo(app.earliest_issued_at)}
                    {app.last_used_at ? ` · last used ${timeAgo(app.last_used_at)}` : null}
                  </p>
                </div>
                <form action={revokeClientAction}>
                  <input type="hidden" name="client_id" value={app.client_id} />
                  <Button
                    type="submit"
                    size="sm"
                    variant="destructive"
                  >
                    Revoke
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight">Onboarding</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Walk through filling in PROFILE.md, GOALS.md, and PRINCIPLES.md so
          your future Claude conversations have real context to reason against.
        </p>
        <div className="mt-4 flex gap-2">
          {onboarding ? <InstallRecipeButton recipe={onboarding} /> : null}
          <a
            href="/agents"
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            Browse all recipes →
          </a>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight">Sign out</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          End this browser session. Connected applications are unaffected — use
          Revoke above to cut MCP access.
        </p>
        <form action="/auth/signout" method="post" className="mt-4">
          <Button type="submit" variant="destructive" size="sm">
            Sign out of this browser
          </Button>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-1 text-sm ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
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
