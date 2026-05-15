import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const auth = pgSchema("auth");

export const usersInAuth = auth.table("users", {
  id: uuid().primaryKey(),
});

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    timezone: text().notNull().default("UTC"),
    unitsSystem: text("units_system").notNull().default("metric"),
    locale: text().notNull().default("en"),
    preferences: jsonb().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_profiles_user_id_key").on(t.userId)],
);

export const workouts = pgTable(
  "workouts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    date: date().notNull(),
    type: text().notNull(),
    durationMin: integer("duration_min"),
    distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
    avgHr: integer("avg_hr"),
    maxHr: integer("max_hr"),
    rpe: smallint(),
    shoes: text(),
    source: text().notNull().default("manual"),
    sourceId: text("source_id"),
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("workouts_user_date_idx").on(t.userId, t.date.desc()),
    index("workouts_user_created_idx").on(t.userId, t.createdAt.desc()),
    uniqueIndex("workouts_source_idem_idx")
      .on(t.userId, t.source, t.sourceId)
      .where(sql`${t.sourceId} is not null`),
    check("workouts_rpe_range", sql`${t.rpe} is null or (${t.rpe} between 1 and 10)`),
  ],
);

export const dailyEntries = pgTable(
  "daily_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    date: date().notNull(),
    sleepH: numeric("sleep_h", { precision: 4, scale: 2 }),
    sleepDeepMin: integer("sleep_deep_min"),
    sleepLightMin: integer("sleep_light_min"),
    sleepRemMin: integer("sleep_rem_min"),
    sleepAwakeMin: integer("sleep_awake_min"),
    hrvMs: integer("hrv_ms"),
    rhrBpm: integer("rhr_bpm"),
    spo2AvgPct: numeric("spo2_avg_pct", { precision: 4, scale: 1 }),
    respirationAvgBrpm: numeric("respiration_avg_brpm", { precision: 4, scale: 1 }),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),
    bodyFatPct: numeric("body_fat_pct", { precision: 4, scale: 1 }),
    steps: integer(),
    activeCalories: integer("active_calories"),
    floorsClimbed: integer("floors_climbed"),
    intensityMinModerate: integer("intensity_min_moderate"),
    intensityMinVigorous: integer("intensity_min_vigorous"),
    fatigue: smallint(),
    soreness: smallint(),
    mood: smallint(),
    stress: smallint(),
    motivation: smallint(),
    sleepQuality: smallint("sleep_quality"),
    sleepNotes: text("sleep_notes"),
    wellnessNotes: text("wellness_notes"),
    mealNotes: text("meal_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("daily_entries_user_date_key").on(t.userId, t.date),
    index("daily_entries_user_date_idx").on(t.userId, t.date.desc()),
    check("daily_fatigue_range", sql`${t.fatigue} is null or (${t.fatigue} between 1 and 5)`),
    check("daily_soreness_range", sql`${t.soreness} is null or (${t.soreness} between 1 and 5)`),
    check("daily_mood_range", sql`${t.mood} is null or (${t.mood} between 1 and 5)`),
    check("daily_stress_range", sql`${t.stress} is null or (${t.stress} between 1 and 5)`),
    check(
      "daily_motivation_range",
      sql`${t.motivation} is null or (${t.motivation} between 1 and 5)`,
    ),
    check(
      "daily_sleep_quality_range",
      sql`${t.sleepQuality} is null or (${t.sleepQuality} between 1 and 5)`,
    ),
  ],
);

export const meals = pgTable(
  "meals",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    eatenAt: timestamp("eaten_at", { withTimezone: true }).notNull(),
    mealType: text("meal_type"),
    description: text().notNull(),
    // Calories + macros are REQUIRED at the MCP boundary via Zod (see
    // lib/mcp/tools/log-meal.ts). The DB column itself stays nullable until
    // the backfill script has populated existing rows; the NOT NULL flip
    // lands in a separate migration / PR after that. See
    // scripts/backfill-meal-macros.ts and docs/schema.md.
    calories: integer(),
    proteinG: numeric("protein_g", { precision: 6, scale: 2 }),
    carbsG: numeric("carbs_g", { precision: 6, scale: 2 }),
    fatG: numeric("fat_g", { precision: 6, scale: 2 }),
    fiberG: numeric("fiber_g", { precision: 6, scale: 2 }),
    notes: text(),
    source: text().notNull().default("manual"),
    sourceId: text("source_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("meals_user_eaten_idx").on(t.userId, t.eatenAt.desc()),
    uniqueIndex("meals_source_idem_idx")
      .on(t.userId, t.source, t.sourceId)
      .where(sql`${t.sourceId} is not null`),
  ],
);

export const healthEvents = pgTable(
  "health_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    date: date().notNull(),
    kind: text().notNull(),
    bodyPart: text("body_part"),
    severity: smallint(),
    notes: text(),
    resolvedDate: date("resolved_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("health_events_user_date_idx").on(t.userId, t.date.desc()),
    index("health_events_active_idx")
      .on(t.userId)
      .where(sql`${t.resolvedDate} is null`),
    check(
      "health_events_kind_check",
      sql`${t.kind} in ('injury', 'illness', 'symptom')`,
    ),
    check(
      "health_events_severity_range",
      sql`${t.severity} is null or (${t.severity} between 1 and 5)`,
    ),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    path: text().notNull(),
    content: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("documents_user_path_key").on(t.userId, t.path),
    index("documents_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.content})`,
    ),
  ],
);

export const oauthClients = pgTable("oauth_clients", {
  id: uuid().primaryKey().defaultRandom(),
  clientId: text("client_id").notNull().unique(),
  clientSecretHash: text("client_secret_hash"),
  name: text().notNull(),
  redirectUris: text("redirect_uris").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oauthCodes = pgTable(
  "oauth_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull().default("S256"),
    scopes: text().array().notNull().default(sql`'{}'::text[]`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("oauth_codes_expires_idx").on(t.expiresAt)],
);

export const installedRecipes = pgTable(
  "installed_recipes",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    recipeId: text("recipe_id").notNull(),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunStatus: text("last_run_status"), // 'ok' | 'failed' | null
    runCount: integer("run_count").notNull().default(0),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("installed_recipes_user_recipe_key").on(t.userId, t.recipeId),
    index("installed_recipes_user_idx").on(t.userId),
  ],
);

export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    accessTokenHash: text("access_token_hash").notNull().unique(),
    refreshTokenHash: text("refresh_token_hash").notNull().unique(),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }).notNull(),
    scopes: text().array().notNull().default(sql`'{}'::text[]`),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("oauth_tokens_active_idx")
      .on(t.userId)
      .where(sql`${t.revokedAt} is null`),
  ],
);
