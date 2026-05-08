import { adminClient } from "@/lib/supabase/admin";
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
  const clientSecret = input.isPublic ? null : generateClientSecret();
  const clientSecretHash = clientSecret ? hashToken(clientSecret) : null;

  const { error } = await adminClient().from("oauth_clients").insert({
    client_id: clientId,
    client_secret_hash: clientSecretHash,
    name: input.name,
    redirect_uris: input.redirectUris,
  });
  if (error) throw new Error(`registerClient: ${error.message}`);

  return {
    clientId,
    clientSecret,
    name: input.name,
    redirectUris: input.redirectUris,
  };
}

export type StoredClient = {
  clientId: string;
  clientSecretHash: string | null;
  name: string;
  redirectUris: string[];
};

export async function getClient(clientId: string): Promise<StoredClient | null> {
  const { data, error } = await adminClient()
    .from("oauth_clients")
    .select("client_id, client_secret_hash, name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(`getClient: ${error.message}`);
  if (!data) return null;
  return {
    clientId: data.client_id,
    clientSecretHash: data.client_secret_hash,
    name: data.name,
    redirectUris: data.redirect_uris,
  };
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
  const { error } = await adminClient().from("oauth_codes").insert({
    code_hash: hashToken(input.code),
    user_id: input.userId,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
    scopes: input.scopes,
    expires_at: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
  });
  if (error) throw new Error(`storeAuthorizationCode: ${error.message}`);
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
  const nowIso = new Date().toISOString();

  // Atomic consume: only succeeds when the row is unconsumed and unexpired.
  const { data, error } = await adminClient()
    .from("oauth_codes")
    .update({ consumed_at: nowIso })
    .eq("code_hash", codeHash)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("user_id, client_id, redirect_uri, code_challenge, code_challenge_method, scopes")
    .maybeSingle();
  if (error) throw new Error(`consumeAuthorizationCode: ${error.message}`);
  if (!data) return null;

  return {
    userId: data.user_id,
    clientId: data.client_id,
    redirectUri: data.redirect_uri,
    codeChallenge: data.code_challenge,
    codeChallengeMethod: data.code_challenge_method,
    scopes: data.scopes,
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

  const now = Date.now();
  const { error } = await adminClient().from("oauth_tokens").insert({
    user_id: params.userId,
    client_id: params.clientId,
    access_token_hash: hashToken(accessToken),
    refresh_token_hash: hashToken(refreshToken),
    access_expires_at: new Date(now + accessTtlSeconds * 1000).toISOString(),
    refresh_expires_at: new Date(now + refreshTtlSeconds * 1000).toISOString(),
    scopes: params.scopes,
  });
  if (error) throw new Error(`issueTokens: ${error.message}`);

  return {
    accessToken,
    refreshToken,
    accessExpiresInSeconds: accessTtlSeconds,
    refreshExpiresInSeconds: refreshTtlSeconds,
  };
}

export type AccessTokenSession = {
  userId: string;
  clientId: string;
  scopes: string[];
};

/**
 * Rotates a refresh token: atomically revokes the old token row and issues a
 * fresh access/refresh pair. Returns null if the refresh token is unknown,
 * already used, expired, or doesn't belong to the expected client.
 *
 * The atomicity comes from the .update().is/gt/eq filters — concurrent
 * refreshes can't both see the row as unrevoked.
 */
export async function rotateRefreshToken(
  refreshToken: string,
  expectedClientId: string,
): Promise<IssuedTokens | null> {
  const sb = adminClient();
  const refreshHash = hashToken(refreshToken);
  const nowIso = new Date().toISOString();

  const { data, error } = await sb
    .from("oauth_tokens")
    .update({ revoked_at: nowIso })
    .eq("refresh_token_hash", refreshHash)
    .eq("client_id", expectedClientId)
    .is("revoked_at", null)
    .gt("refresh_expires_at", nowIso)
    .select("user_id, client_id, scopes")
    .maybeSingle();
  if (error) throw new Error(`rotateRefreshToken: ${error.message}`);
  if (!data) return null;

  return issueTokens({
    userId: data.user_id,
    clientId: data.client_id,
    scopes: data.scopes,
  });
}

export async function lookupAccessToken(
  accessToken: string,
): Promise<AccessTokenSession | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await adminClient()
    .from("oauth_tokens")
    .select("user_id, client_id, scopes")
    .eq("access_token_hash", hashToken(accessToken))
    .is("revoked_at", null)
    .gt("access_expires_at", nowIso)
    .maybeSingle();
  if (error) throw new Error(`lookupAccessToken: ${error.message}`);
  if (!data) return null;
  return {
    userId: data.user_id,
    clientId: data.client_id,
    scopes: data.scopes,
  };
}
