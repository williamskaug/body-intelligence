import Link from "next/link";

export const metadata = { title: "Privacy — Body Intelligence" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Body Intelligence
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026-05-08</p>

      <div className="prose prose-sm mt-8 max-w-none text-sm leading-relaxed">
        <h2 className="text-base font-semibold">What we store</h2>
        <p>
          Workouts, daily check-ins, meals, health events, and a markdown
          memory layer you write — all scoped to your user account.
        </p>
        <h2 className="mt-6 text-base font-semibold">Where it lives</h2>
        <p>
          Supabase (Postgres) for data. Row-level security ensures each
          account can only see its own rows. Connector credentials (Garmin,
          Strava, etc.) are not held by Body Intelligence — those live in
          their respective Claude connectors.
        </p>
        <h2 className="mt-6 text-base font-semibold">No AI inside</h2>
        <p>
          Body Intelligence has no internal AI. Your data is never sent to a
          model by this app. Reasoning happens when you ask Claude in your
          own conversations and Claude reads the data via OAuth-scoped MCP.
        </p>
        <h2 className="mt-6 text-base font-semibold">Deletion</h2>
        <p>
          Delete your account from Settings and all rows tied to your user
          ID — including OAuth tokens — are removed.
        </p>
      </div>
    </main>
  );
}
