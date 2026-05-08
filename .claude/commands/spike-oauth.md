# /spike-oauth

Run the OAuth + remote-MCP integration spike. **This is the highest-risk step in the BI architecture and must succeed before further work.**

## What this validates

That Cowork's MCP client can:
1. Discover the BI MCP via `/.well-known/oauth-authorization-server`
2. Run Dynamic Client Registration against `/api/oauth/register`
3. Complete the authorization-code flow against `/api/oauth/authorize` + `/api/oauth/token`
4. Call a protected MCP tool (`fs_read`) with a `Bearer` token
5. Refresh the token before expiry without user re-prompt

If any step fails, stop and discuss the fallback path with the user before proceeding. Do not paper over a failure with a hack — the auth model is load-bearing.

## Prerequisites

- Next.js app deployed locally on `http://localhost:3000` OR to a Vercel preview URL
- Supabase project provisioned with Auth enabled
- `OAUTH_SIGNING_SECRET` set in env
- One test user account in Supabase Auth
- The five OAuth route handlers stubbed (even minimally — they just need to satisfy the spec)
- The `/api/mcp` route handler registered with `fs_read` as the only tool, validating the Bearer token via `lib/oauth/verify.ts`

## Steps

1. **Seed a test memory document.** With the test user signed in via `supabase-js`, insert one row into `documents`: `path = "PROFILE.md"`, `content = "Spike test profile."`. Confirm RLS lets the user read it.

2. **Add the BI MCP to Cowork.** In Cowork's MCP settings, add a server with URL `http://localhost:3000/api/mcp` (or the Vercel URL). Cowork should detect that authentication is required and trigger the OAuth flow.

3. **Complete the authorization flow.** Cowork opens a browser to `/api/oauth/authorize`. Sign in with the test user (Supabase magic link). Approve the consent screen. Confirm tokens flow back to Cowork.

4. **Call `fs_read("PROFILE.md")` from Claude in Cowork.** The result should be the seeded content. If it returns empty or errors, bisect: token validation? RLS scoping? Tool registration?

5. **Force token refresh.** Manually expire the access token (set its `access_expires_at` to the past in the DB). Make a second tool call. Confirm Cowork refreshes silently and the call succeeds.

6. **Revoke the connection.** From `/settings`, revoke the Cowork connection. Confirm subsequent tool calls return 401 and Cowork prompts to reconnect.

## Output

Update `CLAUDE.md` § *Status tracker → Done* with the spike result. Note any deviations from the spec'd behavior — they become known limitations of the architecture.
