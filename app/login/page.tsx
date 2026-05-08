import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signInWithMagicLink } from "./actions";

type SearchParams = Promise<{
  error?: string;
  sent?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Body Intelligence
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send a magic link.
        </p>

        {sent ? (
          <div className="mt-8 rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Check your inbox</p>
            <p className="mt-1 text-muted-foreground">
              We sent a sign-in link to <span className="font-mono">{sent}</span>.
              The link is valid for one hour.
            </p>
          </div>
        ) : (
          <form action={signInWithMagicLink} className="mt-8 space-y-3">
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                name="email"
                required
                autoFocus
                placeholder="you@example.com"
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <Button type="submit" className="w-full" size="lg">
              Send magic link
            </Button>
            {error ? (
              <p className="text-sm text-destructive">{decodeErrorMessage(error)}</p>
            ) : null}
          </form>
        )}

        <p className="mt-8 text-xs text-muted-foreground">
          By continuing you agree to the{" "}
          <Link href="/legal/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

function decodeErrorMessage(code: string): string {
  if (code === "invalid_email") return "Please enter a valid email address.";
  if (code === "missing_code") return "Magic link was missing — try sending a new one.";
  if (code === "no_user") return "Could not load your account. Try again.";
  return decodeURIComponent(code);
}
