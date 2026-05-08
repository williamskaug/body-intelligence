import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  consumeAuthorizationCode,
  getClient,
  issueTokens,
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

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  if (!body) {
    return tokenError("invalid_request", "Body must be form-encoded or JSON.", 400);
  }

  const parsed = codeGrantSchema.safeParse(body);
  if (!parsed.success) {
    return tokenError(
      "invalid_request",
      parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; "),
      400,
    );
  }

  const { code, redirect_uri, client_id, client_secret, code_verifier } = parsed.data;

  const client = await getClient(client_id);
  if (!client) {
    return tokenError("invalid_client", "Unknown client.", 401);
  }

  // Confidential clients must present a valid secret.
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
    return tokenError("invalid_grant", "Authorization code is invalid, expired, or already used.", 400);
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
  if (!okPkce) {
    return tokenError("invalid_grant", "PKCE verification failed.", 400);
  }

  const tokens = await issueTokens({
    userId: consumed.userId,
    clientId: consumed.clientId,
    scopes: consumed.scopes,
  });

  return NextResponse.json({
    access_token: tokens.accessToken,
    token_type: "Bearer",
    expires_in: tokens.accessExpiresInSeconds,
    refresh_token: tokens.refreshToken,
    scope: consumed.scopes.join(" "),
  });
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
