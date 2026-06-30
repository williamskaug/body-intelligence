CREATE TABLE "capacity_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"vo2max_running" numeric(4, 1),
	"vo2max_cycling" numeric(4, 1),
	"lactate_threshold_hr_bpm" integer,
	"lactate_threshold_pace_s_per_km" integer,
	"lactate_threshold_power_w" integer,
	"cycling_ftp_w" integer,
	"endurance_score" integer,
	"hill_score" smallint,
	"fitness_age_years" numeric(4, 1),
	"running_tolerance_km" numeric(5, 1),
	"race_pred_5k_s" integer,
	"race_pred_10k_s" integer,
	"race_pred_half_s" integer,
	"race_pred_marathon_s" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capacity_vo2max_run_range" CHECK ("capacity_metrics"."vo2max_running" is null or ("capacity_metrics"."vo2max_running" between 10 and 90)),
	CONSTRAINT "capacity_vo2max_cyc_range" CHECK ("capacity_metrics"."vo2max_cycling" is null or ("capacity_metrics"."vo2max_cycling" between 10 and 90)),
	CONSTRAINT "capacity_lthr_range" CHECK ("capacity_metrics"."lactate_threshold_hr_bpm" is null or ("capacity_metrics"."lactate_threshold_hr_bpm" between 60 and 220)),
	CONSTRAINT "capacity_hill_range" CHECK ("capacity_metrics"."hill_score" is null or ("capacity_metrics"."hill_score" between 0 and 100)),
	CONSTRAINT "capacity_fitness_age_range" CHECK ("capacity_metrics"."fitness_age_years" is null or ("capacity_metrics"."fitness_age_years" between 10 and 100)),
	CONSTRAINT "capacity_ftp_nonneg" CHECK ("capacity_metrics"."cycling_ftp_w" is null or "capacity_metrics"."cycling_ftp_w" >= 0),
	CONSTRAINT "capacity_lt_power_nonneg" CHECK ("capacity_metrics"."lactate_threshold_power_w" is null or "capacity_metrics"."lactate_threshold_power_w" >= 0),
	CONSTRAINT "capacity_endurance_nonneg" CHECK ("capacity_metrics"."endurance_score" is null or "capacity_metrics"."endurance_score" >= 0),
	CONSTRAINT "capacity_run_tolerance_nonneg" CHECK ("capacity_metrics"."running_tolerance_km" is null or "capacity_metrics"."running_tolerance_km" >= 0),
	CONSTRAINT "capacity_lt_pace_pos" CHECK ("capacity_metrics"."lactate_threshold_pace_s_per_km" is null or "capacity_metrics"."lactate_threshold_pace_s_per_km" > 0),
	CONSTRAINT "capacity_pred_5k_pos" CHECK ("capacity_metrics"."race_pred_5k_s" is null or "capacity_metrics"."race_pred_5k_s" > 0),
	CONSTRAINT "capacity_pred_10k_pos" CHECK ("capacity_metrics"."race_pred_10k_s" is null or "capacity_metrics"."race_pred_10k_s" > 0),
	CONSTRAINT "capacity_pred_half_pos" CHECK ("capacity_metrics"."race_pred_half_s" is null or "capacity_metrics"."race_pred_half_s" > 0),
	CONSTRAINT "capacity_pred_marathon_pos" CHECK ("capacity_metrics"."race_pred_marathon_s" is null or "capacity_metrics"."race_pred_marathon_s" > 0)
);
--> statement-breakpoint
CREATE TABLE "workout_zones" (
	"workout_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"hr_z1_s" integer,
	"hr_z2_s" integer,
	"hr_z3_s" integer,
	"hr_z4_s" integer,
	"hr_z5_s" integer,
	"power_z1_s" integer,
	"power_z2_s" integer,
	"power_z3_s" integer,
	"power_z4_s" integer,
	"power_z5_s" integer,
	"power_z6_s" integer,
	"power_z7_s" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_zones_hr_z1_nonneg" CHECK ("workout_zones"."hr_z1_s" is null or "workout_zones"."hr_z1_s" >= 0),
	CONSTRAINT "workout_zones_hr_z2_nonneg" CHECK ("workout_zones"."hr_z2_s" is null or "workout_zones"."hr_z2_s" >= 0),
	CONSTRAINT "workout_zones_hr_z3_nonneg" CHECK ("workout_zones"."hr_z3_s" is null or "workout_zones"."hr_z3_s" >= 0),
	CONSTRAINT "workout_zones_hr_z4_nonneg" CHECK ("workout_zones"."hr_z4_s" is null or "workout_zones"."hr_z4_s" >= 0),
	CONSTRAINT "workout_zones_hr_z5_nonneg" CHECK ("workout_zones"."hr_z5_s" is null or "workout_zones"."hr_z5_s" >= 0),
	CONSTRAINT "workout_zones_pw_z1_nonneg" CHECK ("workout_zones"."power_z1_s" is null or "workout_zones"."power_z1_s" >= 0),
	CONSTRAINT "workout_zones_pw_z2_nonneg" CHECK ("workout_zones"."power_z2_s" is null or "workout_zones"."power_z2_s" >= 0),
	CONSTRAINT "workout_zones_pw_z3_nonneg" CHECK ("workout_zones"."power_z3_s" is null or "workout_zones"."power_z3_s" >= 0),
	CONSTRAINT "workout_zones_pw_z4_nonneg" CHECK ("workout_zones"."power_z4_s" is null or "workout_zones"."power_z4_s" >= 0),
	CONSTRAINT "workout_zones_pw_z5_nonneg" CHECK ("workout_zones"."power_z5_s" is null or "workout_zones"."power_z5_s" >= 0),
	CONSTRAINT "workout_zones_pw_z6_nonneg" CHECK ("workout_zones"."power_z6_s" is null or "workout_zones"."power_z6_s" >= 0),
	CONSTRAINT "workout_zones_pw_z7_nonneg" CHECK ("workout_zones"."power_z7_s" is null or "workout_zones"."power_z7_s" >= 0)
);
--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "muscle_mass_kg" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "bone_mass_kg" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "body_water_pct" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "bp_systolic_mmhg" smallint;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "bp_diastolic_mmhg" smallint;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "hydration_ml" integer;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "stress_score" smallint;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "body_battery_morning" smallint;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "body_battery_high" smallint;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "body_battery_low" smallint;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "body_battery_charged" smallint;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "body_battery_drained" smallint;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "training_readiness_score" smallint;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "training_status" text;--> statement-breakpoint
ALTER TABLE "workout_metrics" ADD COLUMN "weather_temp_c" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "workout_metrics" ADD COLUMN "weather_humidity_pct" smallint;--> statement-breakpoint
ALTER TABLE "workout_metrics" ADD COLUMN "strength_volume_kg" numeric(8, 1);--> statement-breakpoint
ALTER TABLE "capacity_metrics" ADD CONSTRAINT "capacity_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_zones" ADD CONSTRAINT "workout_zones_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_zones" ADD CONSTRAINT "workout_zones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capacity_metrics_user_date_key" ON "capacity_metrics" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "capacity_metrics_user_date_idx" ON "capacity_metrics" USING btree ("user_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workout_zones_user_date_idx" ON "workout_zones" USING btree ("user_id","date" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_stress_score_range" CHECK ("daily_entries"."stress_score" is null or ("daily_entries"."stress_score" between 0 and 100));--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_bb_morning_range" CHECK ("daily_entries"."body_battery_morning" is null or ("daily_entries"."body_battery_morning" between 0 and 100));--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_bb_high_range" CHECK ("daily_entries"."body_battery_high" is null or ("daily_entries"."body_battery_high" between 0 and 100));--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_bb_low_range" CHECK ("daily_entries"."body_battery_low" is null or ("daily_entries"."body_battery_low" between 0 and 100));--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_bb_charged_range" CHECK ("daily_entries"."body_battery_charged" is null or ("daily_entries"."body_battery_charged" between 0 and 100));--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_bb_drained_range" CHECK ("daily_entries"."body_battery_drained" is null or ("daily_entries"."body_battery_drained" between 0 and 100));--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_training_readiness_range" CHECK ("daily_entries"."training_readiness_score" is null or ("daily_entries"."training_readiness_score" between 0 and 100));--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_body_water_range" CHECK ("daily_entries"."body_water_pct" is null or ("daily_entries"."body_water_pct" between 0 and 100));--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_muscle_mass_nonneg" CHECK ("daily_entries"."muscle_mass_kg" is null or "daily_entries"."muscle_mass_kg" >= 0);--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_bone_mass_nonneg" CHECK ("daily_entries"."bone_mass_kg" is null or "daily_entries"."bone_mass_kg" >= 0);--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_bp_systolic_range" CHECK ("daily_entries"."bp_systolic_mmhg" is null or ("daily_entries"."bp_systolic_mmhg" between 50 and 260));--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_bp_diastolic_range" CHECK ("daily_entries"."bp_diastolic_mmhg" is null or ("daily_entries"."bp_diastolic_mmhg" between 30 and 200));--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_hydration_nonneg" CHECK ("daily_entries"."hydration_ml" is null or "daily_entries"."hydration_ml" >= 0);--> statement-breakpoint
ALTER TABLE "workout_metrics" ADD CONSTRAINT "workout_metrics_humidity_range" CHECK ("workout_metrics"."weather_humidity_pct" is null or ("workout_metrics"."weather_humidity_pct" between 0 and 100));--> statement-breakpoint
ALTER TABLE "workout_metrics" ADD CONSTRAINT "workout_metrics_strength_volume_nonneg" CHECK ("workout_metrics"."strength_volume_kg" is null or "workout_metrics"."strength_volume_kg" >= 0);--> statement-breakpoint
-- RLS: same owner-scoped pattern as the rest of the user-scoped tables.
-- (Drizzle does not manage RLS — these are hand-appended to the generated file.)
ALTER TABLE "capacity_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "capacity_metrics_owner" ON "capacity_metrics"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());--> statement-breakpoint
ALTER TABLE "workout_zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workout_zones_owner" ON "workout_zones"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());