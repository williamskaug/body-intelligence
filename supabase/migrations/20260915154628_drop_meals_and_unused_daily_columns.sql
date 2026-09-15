ALTER TABLE "meals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "meals" CASCADE;--> statement-breakpoint
ALTER TABLE "daily_entries" DROP CONSTRAINT "daily_fatigue_range";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP CONSTRAINT "daily_soreness_range";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP CONSTRAINT "daily_mood_range";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP CONSTRAINT "daily_stress_range";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP CONSTRAINT "daily_motivation_range";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP CONSTRAINT "daily_sleep_quality_range";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP CONSTRAINT "daily_body_water_range";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP CONSTRAINT "daily_muscle_mass_nonneg";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP CONSTRAINT "daily_bone_mass_nonneg";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP CONSTRAINT "daily_bp_systolic_range";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP CONSTRAINT "daily_bp_diastolic_range";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP CONSTRAINT "daily_hydration_nonneg";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "body_fat_pct";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "muscle_mass_kg";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "bone_mass_kg";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "body_water_pct";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "bp_systolic_mmhg";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "bp_diastolic_mmhg";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "hydration_ml";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "fatigue";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "soreness";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "mood";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "stress";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "motivation";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "sleep_quality";--> statement-breakpoint
ALTER TABLE "daily_entries" DROP COLUMN "meal_notes";