CREATE TABLE "daily_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"sleep_h" numeric(4, 2),
	"hrv_ms" integer,
	"rhr_bpm" integer,
	"weight_kg" numeric(5, 2),
	"fatigue" smallint,
	"soreness" smallint,
	"mood" smallint,
	"stress" smallint,
	"motivation" smallint,
	"sleep_quality" smallint,
	"sleep_notes" text,
	"wellness_notes" text,
	"meal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_fatigue_range" CHECK ("daily_entries"."fatigue" is null or ("daily_entries"."fatigue" between 1 and 5)),
	CONSTRAINT "daily_soreness_range" CHECK ("daily_entries"."soreness" is null or ("daily_entries"."soreness" between 1 and 5)),
	CONSTRAINT "daily_mood_range" CHECK ("daily_entries"."mood" is null or ("daily_entries"."mood" between 1 and 5)),
	CONSTRAINT "daily_stress_range" CHECK ("daily_entries"."stress" is null or ("daily_entries"."stress" between 1 and 5)),
	CONSTRAINT "daily_motivation_range" CHECK ("daily_entries"."motivation" is null or ("daily_entries"."motivation" between 1 and 5)),
	CONSTRAINT "daily_sleep_quality_range" CHECK ("daily_entries"."sleep_quality" is null or ("daily_entries"."sleep_quality" between 1 and 5))
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"body_part" text,
	"severity" smallint,
	"notes" text,
	"resolved_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "health_events_kind_check" CHECK ("health_events"."kind" in ('injury', 'illness', 'symptom')),
	CONSTRAINT "health_events_severity_range" CHECK ("health_events"."severity" is null or ("health_events"."severity" between 1 and 5))
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"eaten_at" timestamp with time zone NOT NULL,
	"meal_type" text,
	"description" text NOT NULL,
	"calories" integer,
	"protein_g" numeric(6, 2),
	"carbs_g" numeric(6, 2),
	"fat_g" numeric(6, 2),
	"fiber_g" numeric(6, 2),
	"notes" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_hash" text,
	"name" text NOT NULL,
	"redirect_uris" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"access_token_hash" text NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_tokens_access_token_hash_unique" UNIQUE("access_token_hash"),
	CONSTRAINT "oauth_tokens_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"units_system" text DEFAULT 'metric' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- auth.users is managed by Supabase Auth; FK targets only.
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"type" text NOT NULL,
	"duration_min" integer,
	"distance_km" numeric(6, 2),
	"avg_hr" integer,
	"max_hr" integer,
	"rpe" smallint,
	"shoes" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workouts_rpe_range" CHECK ("workouts"."rpe" is null or ("workouts"."rpe" between 1 and 10))
);
--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_entries_user_date_key" ON "daily_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "daily_entries_user_date_idx" ON "daily_entries" USING btree ("user_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "documents_user_path_key" ON "documents" USING btree ("user_id","path");--> statement-breakpoint
CREATE INDEX "documents_search_idx" ON "documents" USING gin (to_tsvector('english', "content"));--> statement-breakpoint
CREATE INDEX "health_events_user_date_idx" ON "health_events" USING btree ("user_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "health_events_active_idx" ON "health_events" USING btree ("user_id") WHERE "health_events"."resolved_date" is null;--> statement-breakpoint
CREATE INDEX "meals_user_eaten_idx" ON "meals" USING btree ("user_id","eaten_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "meals_source_idem_idx" ON "meals" USING btree ("user_id","source","source_id") WHERE "meals"."source_id" is not null;--> statement-breakpoint
CREATE INDEX "oauth_tokens_active_idx" ON "oauth_tokens" USING btree ("user_id") WHERE "oauth_tokens"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workouts_user_date_idx" ON "workouts" USING btree ("user_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workouts_user_created_idx" ON "workouts" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "workouts_source_idem_idx" ON "workouts" USING btree ("user_id","source","source_id") WHERE "workouts"."source_id" is not null;