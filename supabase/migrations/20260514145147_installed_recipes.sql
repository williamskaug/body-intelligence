CREATE TABLE "installed_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recipe_id" text NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_run_status" text,
	"run_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "installed_recipes" ADD CONSTRAINT "installed_recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "installed_recipes_user_recipe_key" ON "installed_recipes" USING btree ("user_id","recipe_id");--> statement-breakpoint
CREATE INDEX "installed_recipes_user_idx" ON "installed_recipes" USING btree ("user_id");--> statement-breakpoint
-- RLS: same owner-scoped pattern as the rest of the user-scoped tables.
ALTER TABLE "installed_recipes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "installed_recipes_owner" ON "installed_recipes"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());