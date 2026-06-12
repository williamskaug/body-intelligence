-- One-time canonicalization of workouts.type. Going forward the MCP
-- boundary normalizes types via normalizeWorkoutType() in
-- lib/mcp/tools/shared.ts — this brings existing rows in line so the
-- donut chart, calendar labels, and per-type stats stop fragmenting
-- ("run" vs "running", "ride" vs "road_biking" vs "Road Cycling").
-- Idempotent: every statement is a no-op on already-canonical rows.

UPDATE workouts SET type = lower(regexp_replace(btrim(type), '[\s\-]+', '_', 'g'))
  WHERE type <> lower(regexp_replace(btrim(type), '[\s\-]+', '_', 'g'));--> statement-breakpoint
UPDATE workouts SET type = 'run'       WHERE type IN ('running', 'jog', 'jogging', 'street_running', 'track_running', 'treadmill_running', 'rwd_run');--> statement-breakpoint
UPDATE workouts SET type = 'trail_run' WHERE type IN ('trail', 'trail_running');--> statement-breakpoint
UPDATE workouts SET type = 'ride'      WHERE type IN ('cycling', 'bike', 'biking', 'road_biking', 'road_cycling', 'virtual_ride', 'indoor_cycling');--> statement-breakpoint
UPDATE workouts SET type = 'gravel_ride' WHERE type IN ('gravel', 'gravel_cycling', 'gravel_biking');--> statement-breakpoint
UPDATE workouts SET type = 'mtb'       WHERE type IN ('mountain_biking', 'mtb_ride');--> statement-breakpoint
UPDATE workouts SET type = 'strength'  WHERE type IN ('lift', 'lifting', 'weight_training', 'weighttraining', 'strength_training', 'indoor_strength', 'gym');--> statement-breakpoint
UPDATE workouts SET type = 'walk'      WHERE type IN ('walking', 'casual_walking', 'speed_walking');--> statement-breakpoint
UPDATE workouts SET type = 'hike'      WHERE type IN ('hiking');--> statement-breakpoint
UPDATE workouts SET type = 'swim'      WHERE type IN ('swimming', 'lap_swimming', 'open_water_swimming', 'pool_swim');--> statement-breakpoint
UPDATE workouts SET type = 'row'       WHERE type IN ('rowing', 'indoor_rowing');--> statement-breakpoint
UPDATE workouts SET type = 'xc_ski'    WHERE type IN ('nordic_ski', 'nordic_skiing', 'cross_country_skiing', 'classic_skiing', 'skate_skiing', 'xc_skiing');--> statement-breakpoint
UPDATE workouts SET type = 'padel'     WHERE type IN ('padel_tennis');
