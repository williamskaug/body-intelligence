-- Macros become NOT NULL.
--
-- BEFORE running this migration: every existing row in meals must already
-- have calories/protein_g/carbs_g/fat_g populated. Run
--   pnpm dlx tsx --env-file=.env.local scripts/backfill-meal-macros.ts
-- against production to backfill via Claude estimation. Any rows the
-- script can't estimate (returns skip:true) must be deleted manually before
-- this migration applies, or the ALTER will fail with a constraint violation.

ALTER TABLE "meals" ALTER COLUMN "calories" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "meals" ALTER COLUMN "protein_g" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "meals" ALTER COLUMN "carbs_g" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "meals" ALTER COLUMN "fat_g" SET NOT NULL;