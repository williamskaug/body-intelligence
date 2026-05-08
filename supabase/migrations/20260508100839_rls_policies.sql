-- Enable Row Level Security on every user-scoped table and add the canonical
-- "user_id = auth.uid()" policy. oauth_clients is locked down in a follow-up
-- migration since it has no policy (server-side service role bypasses RLS).

ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "health_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_tokens" ENABLE ROW LEVEL SECURITY;

-- Canonical policy: a row is visible/writable iff its user_id matches
-- the authenticated caller. Applies to SELECT, INSERT, UPDATE, DELETE.

CREATE POLICY "user_profiles_owner" ON "user_profiles"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "workouts_owner" ON "workouts"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "daily_entries_owner" ON "daily_entries"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "meals_owner" ON "meals"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "health_events_owner" ON "health_events"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "documents_owner" ON "documents"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "oauth_tokens_owner" ON "oauth_tokens"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
