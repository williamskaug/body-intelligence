import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/oauth/storage";
import { isValidChallengeFormat } from "@/lib/oauth/pkce";
import { approveAuthorization } from "./actions";

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

  // 1. Validate the authorization request before doing anything else.
  const validation = validateRequest(params);
  if (validation.kind === "error") {
    return <ErrorScreen title="Invalid request" message={validation.message} />;
  }
  const req = validation.req;

  // 2. Look up the client. Reject early if it isn't registered or the
  // redirect_uri doesn't match.
  const client = await getClient(req.clientId);
  if (!client) {
    return <ErrorScreen title="Unknown client" message="This client is not registered." />;
  }
  if (!client.redirectUris.includes(req.redirectUri)) {
    return (
      <ErrorScreen
        title="Redirect URI mismatch"
        message="The redirect_uri does not match any URI registered for this client."
      />
    );
  }

  // 3. Require a Supabase session. Redirect to /login with a next= back here.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const search = new URLSearchParams(params as Record<string, string>).toString();
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${search}`)}`);
  }

  // 4. Show the consent screen. The user can approve or cancel.
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Authorize access
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          {client.name} wants to connect to Body Intelligence
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Signed in as <span className="font-mono">{user.email}</span>. Approving
          will let this application read and write your training, sleep, meals,
          health events, and memory documents through the MCP endpoint.
        </p>

        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Redirects to</dt>
            <dd className="text-right font-mono text-xs break-all">{req.redirectUri}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Client ID</dt>
            <dd className="text-right font-mono text-xs break-all">{req.clientId}</dd>
          </div>
        </dl>

        <form action={approveAuthorization} className="mt-8 flex flex-col gap-2">
          <input type="hidden" name="client_id" value={req.clientId} />
          <input type="hidden" name="redirect_uri" value={req.redirectUri} />
          <input type="hidden" name="code_challenge" value={req.codeChallenge} />
          <input
            type="hidden"
            name="code_challenge_method"
            value={req.codeChallengeMethod}
          />
          {req.state ? <input type="hidden" name="state" value={req.state} /> : null}
          {req.scope ? <input type="hidden" name="scope" value={req.scope} /> : null}
          <Button type="submit" size="lg">
            Approve
          </Button>
        </form>

        <p className="mt-3 text-xs text-muted-foreground">
          You can revoke this access any time from{" "}
          <a href="/settings" className="underline">
            Settings
          </a>
          .
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

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
