CREATE TABLE "derived_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"readiness_gate" text,
	"gate_reason" text,
	"illness_composite" text,
	"skin_temp_flag" boolean,
	"hrv_flag" boolean,
	"rhr_flag" boolean,
	"resp_flag" boolean,
	"hrv_z" numeric(4, 2),
	"rhr_z" numeric(4, 2),
	"sleep_z" numeric(4, 2),
	"sleep_debt_7d_min" integer,
	"sleep_need_min" integer,
	"acute_load_7d" numeric(7, 1),
	"chronic_load_28d" numeric(7, 1),
	"days_to_race" integer,
	"computed_by" text DEFAULT 'agent' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "derived_daily_gate_check" CHECK ("derived_daily"."readiness_gate" is null or "derived_daily"."readiness_gate" in ('green', 'amber', 'red')),
	CONSTRAINT "derived_daily_composite_check" CHECK ("derived_daily"."illness_composite" is null or "derived_daily"."illness_composite" in ('green', 'amber', 'red')),
	CONSTRAINT "derived_daily_sleep_debt_range" CHECK ("derived_daily"."sleep_debt_7d_min" is null or "derived_daily"."sleep_debt_7d_min" >= 0)
);
--> statement-breakpoint
CREATE TABLE "health_event_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"date" date NOT NULL,
	"note" text NOT NULL,
	"severity_at_time" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "health_event_updates_severity_range" CHECK ("health_event_updates"."severity_at_time" is null or ("health_event_updates"."severity_at_time" between 1 and 5))
);
--> statement-breakpoint
CREATE TABLE "workout_metrics" (
	"workout_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"cadence_spm" numeric(5, 2),
	"gct_ms" integer,
	"gct_balance_pct_left" numeric(4, 2),
	"vertical_oscillation_mm" numeric(5, 1),
	"vertical_ratio_pct" numeric(4, 2),
	"stride_len_m" numeric(4, 2),
	"te_aerobic" numeric(2, 1),
	"te_anaerobic" numeric(2, 1),
	"vendor_training_load" numeric(6, 1),
	"stamina_start_pct" smallint,
	"stamina_end_pct" smallint,
	"stamina_min_pct" smallint,
	"decoupling_pct" numeric(5, 2),
	"elevation_gain_m" integer,
	"elevation_loss_m" integer,
	"avg_speed_kmh" numeric(5, 2),
	"max_speed_kmh" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_metrics_gct_balance_range" CHECK ("workout_metrics"."gct_balance_pct_left" is null or ("workout_metrics"."gct_balance_pct_left" between 30 and 70)),
	CONSTRAINT "workout_metrics_te_aerobic_range" CHECK ("workout_metrics"."te_aerobic" is null or ("workout_metrics"."te_aerobic" between 0 and 5)),
	CONSTRAINT "workout_metrics_te_anaerobic_range" CHECK ("workout_metrics"."te_anaerobic" is null or ("workout_metrics"."te_anaerobic" between 0 and 5)),
	CONSTRAINT "workout_metrics_stamina_start_range" CHECK ("workout_metrics"."stamina_start_pct" is null or ("workout_metrics"."stamina_start_pct" between 0 and 100)),
	CONSTRAINT "workout_metrics_stamina_end_range" CHECK ("workout_metrics"."stamina_end_pct" is null or ("workout_metrics"."stamina_end_pct" between 0 and 100)),
	CONSTRAINT "workout_metrics_stamina_min_range" CHECK ("workout_metrics"."stamina_min_pct" is null or ("workout_metrics"."stamina_min_pct" between 0 and 100))
);
--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "skin_temp_deviation_c" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "sleep_score" smallint;--> statement-breakpoint
ALTER TABLE "health_events" ADD COLUMN "next_milestone_date" date;--> statement-breakpoint
ALTER TABLE "health_events" ADD COLUMN "next_milestone" text;--> statement-breakpoint
ALTER TABLE "derived_daily" ADD CONSTRAINT "derived_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_event_updates" ADD CONSTRAINT "health_event_updates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_event_updates" ADD CONSTRAINT "health_event_updates_event_id_health_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."health_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_metrics" ADD CONSTRAINT "workout_metrics_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_metrics" ADD CONSTRAINT "workout_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "derived_daily_user_date_key" ON "derived_daily" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "derived_daily_user_date_idx" ON "derived_daily" USING btree ("user_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "health_event_updates_event_idx" ON "health_event_updates" USING btree ("event_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "health_event_updates_user_idx" ON "health_event_updates" USING btree ("user_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workout_metrics_user_date_idx" ON "workout_metrics" USING btree ("user_id","date" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_sleep_score_range" CHECK ("daily_entries"."sleep_score" is null or ("daily_entries"."sleep_score" between 0 and 100));--> statement-breakpoint
-- RLS: same owner-scoped pattern as the rest of the user-scoped tables.
ALTER TABLE "derived_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "derived_daily_owner" ON "derived_daily"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());--> statement-breakpoint
ALTER TABLE "health_event_updates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "health_event_updates_owner" ON "health_event_updates"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());--> statement-breakpoint
ALTER TABLE "workout_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workout_metrics_owner" ON "workout_metrics"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
