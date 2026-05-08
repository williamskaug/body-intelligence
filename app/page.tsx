import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Body Intelligence
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <Link
                  href="/agents"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Agents
                </Link>
                <Link
                  href="/settings"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Settings
                </Link>
                <span className="ml-2 hidden text-muted-foreground sm:inline">
                  {user.email}
                </span>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/legal/privacy"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Privacy
                </Link>
                <Link
                  href="/legal/terms"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Terms
                </Link>
                <Link
                  href="/login"
                  className={buttonVariants({ size: "sm", className: "ml-2" })}
                >
                  Sign in
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Personal health intelligence for athletes
        </p>
        <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          {user ? `Welcome, ${user.email?.split("@")[0]}.` : "Capture the data. Let Claude do the reasoning."}
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          {user
            ? "You're signed in. The eight standard memory files are seeded for your account; settings, recipe library, and MCP endpoint come next."
            : "Body Intelligence stores your workouts, sleep, meals, and wellness check-ins as structured rows plus a markdown memory layer. The app has no internal AI — Claude reads your data through MCP and reasons against your own training principles."}
        </p>
        <div className="mt-10 flex items-center gap-3">
          {user ? (
            <>
              <Link href="/agents" className={buttonVariants({ size: "lg" })}>
                Open recipe library
              </Link>
              <Link
                href="/settings"
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                Settings
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ size: "lg" })}>
                Get started
              </Link>
              <Link
                href="#how-it-works"
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                How it works
              </Link>
            </>
          )}
        </div>
      </section>

      <section id="how-it-works" className="border-t bg-muted/20">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-16 md:grid-cols-3">
          <Step
            n={1}
            title="Capture"
            body="Log workouts, daily check-ins, meals, and health events through Claude or via connector recipes (Garmin, Strava, Apple Health). Eight tools, all behind OAuth."
          />
          <Step
            n={2}
            title="Reflect"
            body="Eight markdown files — PROFILE, PRINCIPLES, GOALS, CURRENT, HEALTH_LOG, NUTRITION, EQUIPMENT — capture how you train. Claude reads them every conversation."
          />
          <Step
            n={3}
            title="Reason"
            body="Install scheduled-agent recipes (morning check-in, weekly review, race countdown). Claude does the synthesis — the app stays passive."
          />
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-5xl px-6 py-8 text-sm text-muted-foreground">
          Built on Supabase, Next.js, and the Model Context Protocol.
        </div>
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div>
      <div className="text-xs font-mono text-muted-foreground">0{n}</div>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
