import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signInWithMagicLink } from "./actions";

type SearchParams = Promise<{
  error?: string;
  sent?: string;
  next?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, sent, next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(safeNext || "/data");
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
          <nav className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            {sent ? "Check your inbox" : "Sign in"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {sent
              ? "We sent a one-time sign-in link to your email."
              : "Enter your email and we'll send a magic link."}
          </p>

          {sent ? (
            <div className="mt-8 flex flex-col gap-4">
              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                <p>
                  Sent to <span className="font-mono">{sent}</span>.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The link is valid for one hour. Click it on this device for
                  the smoothest experience.
                </p>
              </div>
              <form
                action={signInWithMagicLink}
                className="flex flex-col gap-2"
              >
                <input type="hidden" name="email" value={sent} />
                {safeNext ? (
                  <input type="hidden" name="next" value={safeNext} />
                ) : null}
                <Button type="submit" variant="outline" className="w-full">
                  Resend link
                </Button>
              </form>
              <Link
                href={`/login${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`}
                className="text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Use a different email →
              </Link>
            </div>
          ) : (
            <form action={signInWithMagicLink} className="mt-8 space-y-3">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              {safeNext ? (
                <input type="hidden" name="next" value={safeNext} />
              ) : null}
              <Button type="submit" className="w-full" size="lg">
                Send magic link
              </Button>
              {error ? (
                <p
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {decodeErrorMessage(error)}
                </p>
              ) : null}
            </form>
          )}

          <p className="mt-8 text-xs text-muted-foreground">
            By continuing you agree to the{" "}
            <Link href="/legal/terms" className="underline underline-offset-4">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}

function decodeErrorMessage(code: string): string {
  if (code === "invalid_email") return "Please enter a valid email address.";
  if (code === "missing_code") return "Magic link was missing — try sending a new one.";
  if (code === "no_user") return "Could not load your account. Try again.";
  if (code === "otp_expired")
    return "That link has expired or was already used. Send yourself a new one below.";
  if (code === "access_denied") return "That link is no longer valid. Send a new one below.";
  return decodeURIComponent(code);
}
