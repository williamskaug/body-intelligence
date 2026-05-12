ALTER TABLE "daily_entries" ADD COLUMN "sleep_deep_min" integer;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "sleep_light_min" integer;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "sleep_rem_min" integer;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "sleep_awake_min" integer;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "spo2_avg_pct" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "respiration_avg_brpm" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "body_fat_pct" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "steps" integer;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "active_calories" integer;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "floors_climbed" integer;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "intensity_min_moderate" integer;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD COLUMN "intensity_min_vigorous" integer;