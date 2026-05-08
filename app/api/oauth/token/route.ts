import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  consumeAuthorizationCode,
  getClient,
  issueTokens,
  rotateRefreshToken,
} from "@/lib/oauth/storage";
import { hashToken, safeEqual } from "@/lib/oauth/tokens";
import { verifyChallenge, isValidVerifierFormat } from "@/lib/oauth/pkce";

export const runtime = "nodejs";

const codeGrantSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1),
  redirect_uri: z.string().url(),
  client_id: z.string().min(1),
  client_secret: z.string().optional(),
  code_verifier: z.string().min(1),
});

const refreshGrantSchema = z.object({
  grant_type: z.literal("refresh_token"),
  refresh_token: z.string().min(1),
  client_id: z.string().min(1),
  client_secret: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  if (!body) {
    return tokenError("invalid_request", "Body must be form-encoded or JSON.", 400);
  }

  switch (body.grant_type) {
    case "authorization_code":
      return handleCodeGrant(body);
    case "refresh_token":
      return handleRefreshGrant(body);
    default:
      return tokenError(
        "unsupported_grant_type",
        "grant_type must be authorization_code or refresh_token.",
        400,
      );
  }
}

async function handleCodeGrant(body: Record<string, string>) {
  const parsed = codeGrantSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error.issues);

  const { code, redirect_uri, client_id, client_secret, code_verifier } = parsed.data;

  const client = await getClient(client_id);
  if (!client) return tokenError("invalid_client", "Unknown client.", 401);

  if (client.clientSecretHash) {
    if (!client_secret || !safeEqual(hashToken(client_secret), client.clientSecretHash)) {
      return tokenError("invalid_client", "Client authentication failed.", 401);
    }
  }

  if (!isValidVerifierFormat(code_verifier)) {
    return tokenError("invalid_grant", "code_verifier format is invalid.", 400);
  }

  const consumed = await consumeAuthorizationCode(code);
  if (!consumed) {
    return tokenError(
      "invalid_grant",
      "Authorization code is invalid, expired, or already used.",
      400,
    );
  }
  if (consumed.clientId !== client_id) {
    return tokenError("invalid_grant", "client_id does not match the code.", 400);
  }
  if (consumed.redirectUri !== redirect_uri) {
    return tokenError("invalid_grant", "redirect_uri does not match the code.", 400);
  }

  const okPkce = verifyChallenge(
    code_verifier,
    consumed.codeChallenge,
    consumed.codeChallengeMethod === "plain" ? "plain" : "S256",
  );
  if (!okPkce) return tokenError("invalid_grant", "PKCE verification failed.", 400);

  const tokens = await issueTokens({
    userId: consumed.userId,
    clientId: consumed.clientId,
    scopes: consumed.scopes,
  });

  return tokenResponse(tokens, consumed.scopes);
}

async function handleRefreshGrant(body: Record<string, string>) {
  const parsed = refreshGrantSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error.issues);

  const { refresh_token, client_id, client_secret } = parsed.data;

  const client = await getClient(client_id);
  if (!client) return tokenError("invalid_client", "Unknown client.", 401);
  if (client.clientSecretHash) {
    if (!client_secret || !safeEqual(hashToken(client_secret), client.clientSecretHash)) {
      return tokenError("invalid_client", "Client authentication failed.", 401);
    }
  }

  const tokens = await rotateRefreshToken(refresh_token, client_id);
  if (!tokens) {
    return tokenError(
      "invalid_grant",
      "Refresh token is invalid, expired, revoked, or doesn't belong to this client.",
      400,
    );
  }

  // Refresh-token grants don't carry scope changes in v1; preserve whatever
  // scope was on the previous pair (rotateRefreshToken already did that).
  return tokenResponse(tokens, []);
}

function tokenResponse(
  tokens: Awaited<ReturnType<typeof issueTokens>>,
  scopes: string[],
) {
  return NextResponse.json(
    {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.accessExpiresInSeconds,
      refresh_token: tokens.refreshToken,
      scope: scopes.join(" "),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    },
  );
}

async function readBody(request: NextRequest): Promise<Record<string, string> | null> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      const obj: Record<string, string> = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      return obj;
    }
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      const obj: Record<string, string> = {};
      for (const [k, v] of Object.entries(json)) obj[k] = String(v);
      return obj;
    }
  } catch {
    return null;
  }
  return null;
}

function zodError(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  const description = issues
    .map((i) => `${i.path.map(String).join(".") || "root"}: ${i.message}`)
    .join("; ");
  return tokenError("invalid_request", description, 400);
}

function tokenError(error: string, description: string, status: number) {
  return NextResponse.json(
    { error, error_description: description },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    },
  );
}
