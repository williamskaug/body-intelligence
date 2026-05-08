import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the service_role key. Bypasses RLS, so
 * any code path holding this client must explicitly scope by user_id.
 *
 * Used for:
 *   - OAuth tables (oauth_clients, oauth_codes, oauth_tokens) which are
 *     server-issued and have no user-session at write time
 *   - MCP tool execution where the user is already authenticated via OAuth
 *     bearer token (not via Supabase session cookie)
 *
 * Never import this from anything that runs in the browser.
 */
export function adminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
