"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateOpaqueToken } from "@/lib/oauth/tokens";
import { getClient, storeAuthorizationCode } from "@/lib/oauth/storage";

const AUTH_CODE_TTL_SECONDS = 120;

export async function approveAuthorization(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const codeChallengeMethod = String(formData.get("code_challenge_method") ?? "S256");
  const state = formData.get("state") ? String(formData.get("state")) : "";
  const scope = formData.get("scope") ? String(formData.get("scope")) : "";

  if (!clientId || !redirectUri || !codeChallenge) {
    redirect("/oauth/authorize?error=invalid_request");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const client = await getClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    redirect("/oauth/authorize?error=invalid_client");
  }

  const code = generateOpaqueToken(32);
  await storeAuthorizationCode({
    code,
    userId: user!.id,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scopes: scope ? scope.split(" ").filter(Boolean) : [],
    ttlSeconds: AUTH_CODE_TTL_SECONDS,
  });

  // Redirect back to the client's redirect_uri with the code.
  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  redirect(target.toString());
}
