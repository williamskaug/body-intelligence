import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/data");
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span
              aria-hidden
              className="inline-block size-2 rounded-full bg-foreground"
            />
            Body Intelligence
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/legal/privacy"
              className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Terms
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ size: "sm", className: "ml-2" })}
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.65_0.05_240_/_0.08),transparent_70%)]"
        />
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-24 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Personal health intelligence for athletes
          </p>
          <h1 className="mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Capture the data. Let Claude do the reasoning.
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Body Intelligence stores your workouts, sleep, meals, and wellness
            check-ins as structured rows plus a markdown memory layer. The app
            has no internal AI — Claude reads your data through MCP and reasons
            against your own training principles.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Get started
            </Link>
            <Link
              href="#how-it-works"
              className={buttonVariants({ variant: "ghost", size: "lg" })}
            >
              How it works ↓
            </Link>
          </div>

          <div className="mt-16 grid w-full max-w-3xl grid-cols-2 gap-x-6 gap-y-3 text-left text-xs sm:grid-cols-4">
            <CaptureGroup label="Workouts" items={["Type", "Duration", "Distance", "HR", "RPE"]} />
            <CaptureGroup label="Vitals" items={["Sleep", "HRV", "RHR", "SpO₂", "Weight"]} />
            <CaptureGroup label="Meals" items={["Time", "Description", "Calories", "Protein/Carb/Fat"]} />
            <CaptureGroup label="Wellness" items={["Fatigue", "Soreness", "Mood", "Stress", "Motivation"]} />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t bg-muted/20">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-20 md:grid-cols-3">
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
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground">
          <span>Built on Supabase, Next.js, and the Model Context Protocol.</span>
          <nav className="flex items-center gap-4">
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div>
      <div className="font-mono text-xs text-muted-foreground">0{n}</div>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function CaptureGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="border-l border-border/60 pl-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <ul className="mt-2 space-y-1 text-foreground/80">
        {items.map((it) => (
          <li key={it} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-1 rounded-full bg-foreground/30" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
