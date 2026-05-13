import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/oauth/storage";
import { isValidChallengeFormat } from "@/lib/oauth/pkce";
import { approveAuthorization, denyAuthorization } from "./actions";

type SearchParams = Promise<{
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
}>;

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const validation = validateRequest(params);
  if (validation.kind === "error") {
    return <ErrorScreen title="Invalid request" message={validation.message} />;
  }
  const req = validation.req;

  const client = await getClient(req.clientId);
  if (!client) {
    return (
      <ErrorScreen
        title="Unknown client"
        message="This MCP client is not registered with Body Intelligence."
      />
    );
  }
  if (!client.redirectUris.includes(req.redirectUri)) {
    return (
      <ErrorScreen
        title="Redirect URI mismatch"
        message="The redirect_uri does not match any URI registered for this client. This usually means the client was configured with a different URL than it is using now."
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const search = new URLSearchParams(params as Record<string, string>).toString();
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${search}`)}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-12 sm:px-6">
      <div className="w-full rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden className="inline-block size-1.5 rounded-full bg-foreground/60" />
          Body Intelligence
        </Link>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Authorize access
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          {client.name} wants to connect
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Signed in as <span className="font-mono">{user.email}</span>.
        </p>

        <div className="mt-6 rounded-lg border bg-muted/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Approving grants this application permission to
          </p>
          <ul className="mt-3 space-y-2.5 text-sm">
            <PermissionRow>
              Read and write your workouts, daily entries, meals, and health
              events
            </PermissionRow>
            <PermissionRow>
              Read and write your memory documents (PROFILE, GOALS, PRINCIPLES,
              etc.)
            </PermissionRow>
            <PermissionRow>
              Operate on behalf of your account through the MCP endpoint
            </PermissionRow>
          </ul>
        </div>

        <dl className="mt-6 space-y-2 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Redirects to</dt>
            <dd className="text-right font-mono break-all">{req.redirectUri}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Client ID</dt>
            <dd className="text-right font-mono break-all">{req.clientId}</dd>
          </div>
        </dl>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <form action={approveAuthorization} className="flex-1">
            <input type="hidden" name="client_id" value={req.clientId} />
            <input type="hidden" name="redirect_uri" value={req.redirectUri} />
            <input type="hidden" name="code_challenge" value={req.codeChallenge} />
            <input
              type="hidden"
              name="code_challenge_method"
              value={req.codeChallengeMethod}
            />
            {req.state ? (
              <input type="hidden" name="state" value={req.state} />
            ) : null}
            {req.scope ? (
              <input type="hidden" name="scope" value={req.scope} />
            ) : null}
            <Button type="submit" size="lg" className="w-full">
              Approve
            </Button>
          </form>
          <form action={denyAuthorization} className="sm:w-auto">
            <input type="hidden" name="redirect_uri" value={req.redirectUri} />
            {req.state ? (
              <input type="hidden" name="state" value={req.state} />
            ) : null}
            <Button
              type="submit"
              size="lg"
              variant="outline"
              className="w-full"
            >
              Cancel
            </Button>
          </form>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          You can revoke this access any time from{" "}
          <Link href="/settings" className="underline underline-offset-4">
            Settings
          </Link>
          . Tokens expire after 1 hour and refresh up to 30 days.
        </p>
      </div>
    </main>
  );
}

type ValidatedRequest = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  state?: string;
  scope?: string;
};

type Validation =
  | { kind: "ok"; req: ValidatedRequest }
  | { kind: "error"; message: string };

function validateRequest(params: Awaited<SearchParams>): Validation {
  const {
    client_id,
    redirect_uri,
    response_type,
    code_challenge,
    code_challenge_method,
    state,
    scope,
  } = params;

  if (response_type !== "code") {
    return { kind: "error", message: "response_type must be 'code'." };
  }
  if (!client_id) return { kind: "error", message: "client_id is required." };
  if (!redirect_uri) return { kind: "error", message: "redirect_uri is required." };
  if (!code_challenge || !isValidChallengeFormat(code_challenge)) {
    return {
      kind: "error",
      message: "code_challenge is required and must be 43–128 chars from the unreserved set.",
    };
  }
  if (code_challenge_method && code_challenge_method !== "S256") {
    return { kind: "error", message: "Only S256 is supported for code_challenge_method." };
  }

  return {
    kind: "ok",
    req: {
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: "S256",
      state,
      scope,
    },
  };
}

function PermissionRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <svg
        viewBox="0 0 16 16"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-12 sm:px-6">
      <div className="w-full rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Body Intelligence
        </Link>
        <h1 className="mt-6 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
