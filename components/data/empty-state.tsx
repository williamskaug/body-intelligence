import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function EmptyDataState({ email }: { email: string }) {
  const firstName = email.split("@")[0] || "there";
  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Welcome
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Hi {firstName} — nothing logged yet.
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Body Intelligence is a passive store. It only fills in once you (or a
          scheduled Claude recipe) start writing. Here&apos;s how to get the
          first few rows in.
        </p>
      </header>

      <ol className="flex flex-col gap-3">
        <Step
          n={1}
          title="Connect Cowork (or another Claude client) to the MCP endpoint"
          body={
            <>
              The endpoint URL is on the{" "}
              <Link
                href="/settings"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Settings page
              </Link>
              . Adding it to Cowork triggers an OAuth handshake — approve it
              once and Claude gets read/write access to your account.
            </>
          }
        />
        <Step
          n={2}
          title="Install a capture recipe"
          body={
            <>
              The{" "}
              <Link
                href="/agents"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Recipe library
              </Link>{" "}
              has six starter prompts. Begin with{" "}
              <span className="font-mono text-foreground">Onboarding</span> to
              fill in PROFILE/GOALS/PRINCIPLES, then{" "}
              <span className="font-mono text-foreground">Morning check-in</span>{" "}
              to start logging daily entries.
            </>
          }
        />
        <Step
          n={3}
          title="Log anything manually, anytime"
          body="In any Claude conversation that has your BI MCP connected, ask it to log a workout, log a meal, or write to a memory document. Whatever Claude writes shows up here within seconds."
        />
      </ol>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/settings"
          className={buttonVariants({ size: "lg" })}
        >
          Open settings & MCP URL
        </Link>
        <Link
          href="/agents"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Browse recipes
        </Link>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground font-mono text-sm text-background">
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </li>
  );
}
