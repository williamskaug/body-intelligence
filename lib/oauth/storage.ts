import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { oauthClients, oauthCodes, oauthTokens } from "@/lib/db/schema";
import {
  generateClientId,
  generateClientSecret,
  generateOpaqueToken,
  hashToken,
} from "./tokens";

export type RegisterClientInput = {
  name: string;
  redirectUris: string[];
  isPublic?: boolean;
};

export type RegisteredClient = {
  clientId: string;
  clientSecret: string | null;
  name: string;
  redirectUris: string[];
};

export async function registerClient(
  input: RegisterClientInput,
): Promise<RegisteredClient> {
  const clientId = generateClientId();
  // PKCE-only public clients (the typical MCP case) don't get a secret.
  const clientSecret = input.isPublic ? null : generateClientSecret();
  const clientSecretHash = clientSecret ? hashToken(clientSecret) : null;

  await db.insert(oauthClients).values({
    clientId,
    clientSecretHash,
    name: input.name,
    redirectUris: input.redirectUris,
  });

  return {
    clientId,
    clientSecret,
    name: input.name,
    redirectUris: input.redirectUris,
  };
}

export async function getClient(clientId: string) {
  const rows = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);
  return rows[0] ?? null;
}

export type StoreCodeInput = {
  code: string;
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scopes: string[];
  ttlSeconds: number;
};

export async function storeAuthorizationCode(input: StoreCodeInput): Promise<void> {
  await db.insert(oauthCodes).values({
    codeHash: hashToken(input.code),
    userId: input.userId,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    scopes: input.scopes,
    expiresAt: new Date(Date.now() + input.ttlSeconds * 1000),
  });
}

export type ConsumedCode = {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scopes: string[];
};

export async function consumeAuthorizationCode(
  code: string,
): Promise<ConsumedCode | null> {
  const codeHash = hashToken(code);
  const now = new Date();

  const rows = await db
    .update(oauthCodes)
    .set({ consumedAt: now })
    .where(
      and(
        eq(oauthCodes.codeHash, codeHash),
        isNull(oauthCodes.consumedAt),
        gt(oauthCodes.expiresAt, now),
      ),
    )
    .returning();

  const row = rows[0];
  if (!row) return null;

  return {
    userId: row.userId,
    clientId: row.clientId,
    redirectUri: row.redirectUri,
    codeChallenge: row.codeChallenge,
    codeChallengeMethod: row.codeChallengeMethod,
    scopes: row.scopes,
  };
}

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSeconds: number;
  refreshExpiresInSeconds: number;
};

export async function issueTokens(params: {
  userId: string;
  clientId: string;
  scopes: string[];
}): Promise<IssuedTokens> {
  const accessToken = generateOpaqueToken(32);
  const refreshToken = generateOpaqueToken(32);

  const accessTtlSeconds = Number(process.env.OAUTH_ACCESS_TOKEN_TTL_SECONDS ?? 3600);
  const refreshTtlSeconds = Number(
    process.env.OAUTH_REFRESH_TOKEN_TTL_SECONDS ?? 30 * 24 * 3600,
  );

  await db.insert(oauthTokens).values({
    userId: params.userId,
    clientId: params.clientId,
    accessTokenHash: hashToken(accessToken),
    refreshTokenHash: hashToken(refreshToken),
    accessExpiresAt: new Date(Date.now() + accessTtlSeconds * 1000),
    refreshExpiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
    scopes: params.scopes,
  });

  return {
    accessToken,
    refreshToken,
    accessExpiresInSeconds: accessTtlSeconds,
    refreshExpiresInSeconds: refreshTtlSeconds,
  };
}

export async function lookupAccessToken(accessToken: string) {
  const rows = await db
    .select()
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.accessTokenHash, hashToken(accessToken)),
        isNull(oauthTokens.revokedAt),
        gt(oauthTokens.accessExpiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
