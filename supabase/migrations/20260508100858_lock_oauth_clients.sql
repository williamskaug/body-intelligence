-- Lock down oauth_clients: RLS enabled with no policy means no anon or
-- authenticated access. Our server reads/writes the table via the Supabase
-- service role, which bypasses RLS — that path is the only intended one.

ALTER TABLE "oauth_clients" ENABLE ROW LEVEL SECURITY;
