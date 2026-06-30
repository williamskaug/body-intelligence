import { sql } from "drizzle-orm";
import {
  boolean,
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
    // Smart-scale body composition — captured, vendor-measured scalars.
    muscleMassKg: numeric("muscle_mass_kg", { precision: 5, scale: 2 }),
    boneMassKg: numeric("bone_mass_kg", { precision: 4, scale: 2 }),
    bodyWaterPct: numeric("body_water_pct", { precision: 4, scale: 1 }),
    // Optional health vitals — only present when the user logs them.
    bpSystolicMmhg: smallint("bp_systolic_mmhg"),
    bpDiastolicMmhg: smallint("bp_diastolic_mmhg"),
    hydrationMl: integer("hydration_ml"),
    // Cross-vendor sensor measurement (Garmin/Oura/Whoop/Apple all expose a
    // nightly skin/wrist temperature deviation). Vendor-branded composites
    // (Body Battery, Readiness) stay in daily/YYYY-MM-DD.md documents.
    skinTempDeviationC: numeric("skin_temp_deviation_c", { precision: 4, scale: 2 }),
    // 0-100 last-night sleep quality score — a cross-vendor concept even
    // though each vendor computes it differently. Factor breakdowns stay
    // in daily/YYYY-MM-DD.md.
    sleepScore: smallint("sleep_score"),
    // Recovery / readiness vendor SCALARS — captured observations, never
    // BI-authored verdicts. The Body Battery curve, the readiness factor
    // breakdown, and the HRV-status label stay in daily/YYYY-MM-DD.md; only
    // the trendable scalar lands in a column so the stats engine can chart it.
    stressScore: smallint("stress_score"),
    bodyBatteryMorning: smallint("body_battery_morning"),
    bodyBatteryHigh: smallint("body_battery_high"),
    bodyBatteryLow: smallint("body_battery_low"),
    bodyBatteryCharged: smallint("body_battery_charged"),
    bodyBatteryDrained: smallint("body_battery_drained"),
    trainingReadinessScore: smallint("training_readiness_score"),
    // Vendor training-status enum (productive|maintaining|recovery|unproductive|
    // detraining|overreaching|peaking). NO check — the vendor vocabulary may
    // grow; store lowercased, mirroring the workouts.type decision.
    trainingStatus: text("training_status"),
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
    check(
      "daily_sleep_score_range",
      sql`${t.sleepScore} is null or (${t.sleepScore} between 0 and 100)`,
    ),
    check(
      "daily_stress_score_range",
      sql`${t.stressScore} is null or (${t.stressScore} between 0 and 100)`,
    ),
    check(
      "daily_bb_morning_range",
      sql`${t.bodyBatteryMorning} is null or (${t.bodyBatteryMorning} between 0 and 100)`,
    ),
    check(
      "daily_bb_high_range",
      sql`${t.bodyBatteryHigh} is null or (${t.bodyBatteryHigh} between 0 and 100)`,
    ),
    check(
      "daily_bb_low_range",
      sql`${t.bodyBatteryLow} is null or (${t.bodyBatteryLow} between 0 and 100)`,
    ),
    check(
      "daily_bb_charged_range",
      sql`${t.bodyBatteryCharged} is null or (${t.bodyBatteryCharged} between 0 and 100)`,
    ),
    check(
      "daily_bb_drained_range",
      sql`${t.bodyBatteryDrained} is null or (${t.bodyBatteryDrained} between 0 and 100)`,
    ),
    check(
      "daily_training_readiness_range",
      sql`${t.trainingReadinessScore} is null or (${t.trainingReadinessScore} between 0 and 100)`,
    ),
    check(
      "daily_body_water_range",
      sql`${t.bodyWaterPct} is null or (${t.bodyWaterPct} between 0 and 100)`,
    ),
    check(
      "daily_muscle_mass_nonneg",
      sql`${t.muscleMassKg} is null or ${t.muscleMassKg} >= 0`,
    ),
    check(
      "daily_bone_mass_nonneg",
      sql`${t.boneMassKg} is null or ${t.boneMassKg} >= 0`,
    ),
    check(
      "daily_bp_systolic_range",
      sql`${t.bpSystolicMmhg} is null or (${t.bpSystolicMmhg} between 50 and 260)`,
    ),
    check(
      "daily_bp_diastolic_range",
      sql`${t.bpDiastolicMmhg} is null or (${t.bpDiastolicMmhg} between 30 and 200)`,
    ),
    check(
      "daily_hydration_nonneg",
      sql`${t.hydrationMl} is null or ${t.hydrationMl} >= 0`,
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
    // The next checkpoint that gates progression on this event — e.g.
    // "MRI + X-ray, structural clearance gate" on 2026-06-23. Lives here
    // (not in prose) so briefings and the UI can render days-until.
    nextMilestoneDate: date("next_milestone_date"),
    nextMilestone: text("next_milestone"),
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

// Dated thread updates on a health event. The event row stays the summary
// (current severity, resolved_date, next milestone); the day-to-day story
// lives here instead of being appended into health_events.notes.
export const healthEventUpdates = pgTable(
  "health_event_updates",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => healthEvents.id, { onDelete: "cascade" }),
    date: date().notNull(),
    note: text().notNull(),
    severityAtTime: smallint("severity_at_time"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("health_event_updates_event_idx").on(t.eventId, t.date.desc()),
    index("health_event_updates_user_idx").on(t.userId, t.date.desc()),
    check(
      "health_event_updates_severity_range",
      sql`${t.severityAtTime} is null or (${t.severityAtTime} between 1 and 5)`,
    ),
  ],
);

// Agent-computed derived layer — readiness gate, illness composite,
// z-scores, sleep debt, chronic load. BI itself NEVER writes this table
// (passive principle): a scheduled Claude agent computes the values and
// parks them here via log_derived_daily so the UI can render and trend
// them. Unlike daily_entries (partial merge), writes are full-row REPLACE
// per (user, date) — a recompute must never leave stale flags behind.
export const derivedDaily = pgTable(
  "derived_daily",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    date: date().notNull(),
    readinessGate: text("readiness_gate"),
    gateReason: text("gate_reason"),
    illnessComposite: text("illness_composite"),
    skinTempFlag: boolean("skin_temp_flag"),
    hrvFlag: boolean("hrv_flag"),
    rhrFlag: boolean("rhr_flag"),
    respFlag: boolean("resp_flag"),
    hrvZ: numeric("hrv_z", { precision: 4, scale: 2 }),
    rhrZ: numeric("rhr_z", { precision: 4, scale: 2 }),
    sleepZ: numeric("sleep_z", { precision: 4, scale: 2 }),
    sleepDebt7dMin: integer("sleep_debt_7d_min"),
    sleepNeedMin: integer("sleep_need_min"),
    acuteLoad7d: numeric("acute_load_7d", { precision: 7, scale: 1 }),
    chronicLoad28d: numeric("chronic_load_28d", { precision: 7, scale: 1 }),
    daysToRace: integer("days_to_race"),
    computedBy: text("computed_by").notNull().default("agent"),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("derived_daily_user_date_key").on(t.userId, t.date),
    index("derived_daily_user_date_idx").on(t.userId, t.date.desc()),
    check(
      "derived_daily_gate_check",
      sql`${t.readinessGate} is null or ${t.readinessGate} in ('green', 'amber', 'red')`,
    ),
    check(
      "derived_daily_composite_check",
      sql`${t.illnessComposite} is null or ${t.illnessComposite} in ('green', 'amber', 'red')`,
    ),
    check(
      "derived_daily_sleep_debt_range",
      sql`${t.sleepDebt7dMin} is null or ${t.sleepDebt7dMin} >= 0`,
    ),
  ],
);

// Per-workout sensor metrics (running dynamics, training effect, stamina,
// durability). 1:1 side table keyed by workout_id so the hot workouts list
// payloads stay lean — golf/strength/walk rows would carry ~16 NULLs.
// `date` is denormalized from the workout row so get_stats/get_baseline
// can range-scan without a join. Lap splits and vendor labels stay in
// daily/YYYY-MM-DD.md documents.
export const workoutMetrics = pgTable(
  "workout_metrics",
  {
    workoutId: uuid("workout_id")
      .primaryKey()
      .references(() => workouts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    date: date().notNull(),
    cadenceSpm: numeric("cadence_spm", { precision: 5, scale: 2 }),
    gctMs: integer("gct_ms"),
    gctBalancePctLeft: numeric("gct_balance_pct_left", { precision: 4, scale: 2 }),
    verticalOscillationMm: numeric("vertical_oscillation_mm", { precision: 5, scale: 1 }),
    verticalRatioPct: numeric("vertical_ratio_pct", { precision: 4, scale: 2 }),
    strideLenM: numeric("stride_len_m", { precision: 4, scale: 2 }),
    teAerobic: numeric("te_aerobic", { precision: 2, scale: 1 }),
    teAnaerobic: numeric("te_anaerobic", { precision: 2, scale: 1 }),
    vendorTrainingLoad: numeric("vendor_training_load", { precision: 6, scale: 1 }),
    staminaStartPct: smallint("stamina_start_pct"),
    staminaEndPct: smallint("stamina_end_pct"),
    staminaMinPct: smallint("stamina_min_pct"),
    decouplingPct: numeric("decoupling_pct", { precision: 5, scale: 2 }),
    elevationGainM: integer("elevation_gain_m"),
    elevationLossM: integer("elevation_loss_m"),
    avgSpeedKmh: numeric("avg_speed_kmh", { precision: 5, scale: 2 }),
    maxSpeedKmh: numeric("max_speed_kmh", { precision: 5, scale: 2 }),
    // Environmental + strength context (one scalar per activity). Lets the
    // stats engine correlate heat/humidity against decoupling/HR drift, and
    // trend a strength session's total volume. Per-exercise set detail and
    // weather narrative stay in daily/YYYY-MM-DD.md.
    weatherTempC: numeric("weather_temp_c", { precision: 4, scale: 1 }),
    weatherHumidityPct: smallint("weather_humidity_pct"),
    strengthVolumeKg: numeric("strength_volume_kg", { precision: 8, scale: 1 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("workout_metrics_user_date_idx").on(t.userId, t.date.desc()),
    check(
      "workout_metrics_humidity_range",
      sql`${t.weatherHumidityPct} is null or (${t.weatherHumidityPct} between 0 and 100)`,
    ),
    check(
      "workout_metrics_strength_volume_nonneg",
      sql`${t.strengthVolumeKg} is null or ${t.strengthVolumeKg} >= 0`,
    ),
    check(
      "workout_metrics_gct_balance_range",
      sql`${t.gctBalancePctLeft} is null or (${t.gctBalancePctLeft} between 30 and 70)`,
    ),
    check(
      "workout_metrics_te_aerobic_range",
      sql`${t.teAerobic} is null or (${t.teAerobic} between 0 and 5)`,
    ),
    check(
      "workout_metrics_te_anaerobic_range",
      sql`${t.teAnaerobic} is null or (${t.teAnaerobic} between 0 and 5)`,
    ),
    check(
      "workout_metrics_stamina_start_range",
      sql`${t.staminaStartPct} is null or (${t.staminaStartPct} between 0 and 100)`,
    ),
    check(
      "workout_metrics_stamina_end_range",
      sql`${t.staminaEndPct} is null or (${t.staminaEndPct} between 0 and 100)`,
    ),
    check(
      "workout_metrics_stamina_min_range",
      sql`${t.staminaMinPct} is null or (${t.staminaMinPct} between 0 and 100)`,
    ),
  ],
);

// Per-activity time-in-zone (HR zones + cycling power zones), seconds per
// zone. 1:1 side table keyed by workout_id so the mostly-null power columns
// don't bloat workout_metrics. `date` denormalized for one-table range scans.
// Written via the nested `zones` object on the workout write tools (full
// replace per workout). Lets the stats engine trend intensity distribution.
export const workoutZones = pgTable(
  "workout_zones",
  {
    workoutId: uuid("workout_id")
      .primaryKey()
      .references(() => workouts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    date: date().notNull(),
    hrZ1S: integer("hr_z1_s"),
    hrZ2S: integer("hr_z2_s"),
    hrZ3S: integer("hr_z3_s"),
    hrZ4S: integer("hr_z4_s"),
    hrZ5S: integer("hr_z5_s"),
    powerZ1S: integer("power_z1_s"),
    powerZ2S: integer("power_z2_s"),
    powerZ3S: integer("power_z3_s"),
    powerZ4S: integer("power_z4_s"),
    powerZ5S: integer("power_z5_s"),
    powerZ6S: integer("power_z6_s"),
    powerZ7S: integer("power_z7_s"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("workout_zones_user_date_idx").on(t.userId, t.date.desc()),
    check("workout_zones_hr_z1_nonneg", sql`${t.hrZ1S} is null or ${t.hrZ1S} >= 0`),
    check("workout_zones_hr_z2_nonneg", sql`${t.hrZ2S} is null or ${t.hrZ2S} >= 0`),
    check("workout_zones_hr_z3_nonneg", sql`${t.hrZ3S} is null or ${t.hrZ3S} >= 0`),
    check("workout_zones_hr_z4_nonneg", sql`${t.hrZ4S} is null or ${t.hrZ4S} >= 0`),
    check("workout_zones_hr_z5_nonneg", sql`${t.hrZ5S} is null or ${t.hrZ5S} >= 0`),
    check("workout_zones_pw_z1_nonneg", sql`${t.powerZ1S} is null or ${t.powerZ1S} >= 0`),
    check("workout_zones_pw_z2_nonneg", sql`${t.powerZ2S} is null or ${t.powerZ2S} >= 0`),
    check("workout_zones_pw_z3_nonneg", sql`${t.powerZ3S} is null or ${t.powerZ3S} >= 0`),
    check("workout_zones_pw_z4_nonneg", sql`${t.powerZ4S} is null or ${t.powerZ4S} >= 0`),
    check("workout_zones_pw_z5_nonneg", sql`${t.powerZ5S} is null or ${t.powerZ5S} >= 0`),
    check("workout_zones_pw_z6_nonneg", sql`${t.powerZ6S} is null or ${t.powerZ6S} >= 0`),
    check("workout_zones_pw_z7_nonneg", sql`${t.powerZ7S} is null or ${t.powerZ7S} >= 0`),
  ],
);

// Slow-moving fitness-capacity snapshots, written weekly by the capacity-sync
// recipe (and never by BI itself). Wide one-row-per-(user,date) so each metric
// is a column that slots into the resolveMetric → select(column) stats
// machinery with zero changes to get_stats/get_baseline. Capacity here is a
// captured vendor estimate, not a BI-authored judgment.
export const capacityMetrics = pgTable(
  "capacity_metrics",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    date: date().notNull(),
    vo2maxRunning: numeric("vo2max_running", { precision: 4, scale: 1 }),
    vo2maxCycling: numeric("vo2max_cycling", { precision: 4, scale: 1 }),
    lactateThresholdHrBpm: integer("lactate_threshold_hr_bpm"),
    lactateThresholdPaceSPerKm: integer("lactate_threshold_pace_s_per_km"),
    lactateThresholdPowerW: integer("lactate_threshold_power_w"),
    cyclingFtpW: integer("cycling_ftp_w"),
    enduranceScore: integer("endurance_score"),
    hillScore: smallint("hill_score"),
    fitnessAgeYears: numeric("fitness_age_years", { precision: 4, scale: 1 }),
    runningToleranceKm: numeric("running_tolerance_km", { precision: 5, scale: 1 }),
    racePred5kS: integer("race_pred_5k_s"),
    racePred10kS: integer("race_pred_10k_s"),
    racePredHalfS: integer("race_pred_half_s"),
    racePredMarathonS: integer("race_pred_marathon_s"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("capacity_metrics_user_date_key").on(t.userId, t.date),
    index("capacity_metrics_user_date_idx").on(t.userId, t.date.desc()),
    check(
      "capacity_vo2max_run_range",
      sql`${t.vo2maxRunning} is null or (${t.vo2maxRunning} between 10 and 90)`,
    ),
    check(
      "capacity_vo2max_cyc_range",
      sql`${t.vo2maxCycling} is null or (${t.vo2maxCycling} between 10 and 90)`,
    ),
    check(
      "capacity_lthr_range",
      sql`${t.lactateThresholdHrBpm} is null or (${t.lactateThresholdHrBpm} between 60 and 220)`,
    ),
    check(
      "capacity_hill_range",
      sql`${t.hillScore} is null or (${t.hillScore} between 0 and 100)`,
    ),
    check(
      "capacity_fitness_age_range",
      sql`${t.fitnessAgeYears} is null or (${t.fitnessAgeYears} between 10 and 100)`,
    ),
    check("capacity_ftp_nonneg", sql`${t.cyclingFtpW} is null or ${t.cyclingFtpW} >= 0`),
    check(
      "capacity_lt_power_nonneg",
      sql`${t.lactateThresholdPowerW} is null or ${t.lactateThresholdPowerW} >= 0`,
    ),
    check(
      "capacity_endurance_nonneg",
      sql`${t.enduranceScore} is null or ${t.enduranceScore} >= 0`,
    ),
    check(
      "capacity_run_tolerance_nonneg",
      sql`${t.runningToleranceKm} is null or ${t.runningToleranceKm} >= 0`,
    ),
    check(
      "capacity_lt_pace_pos",
      sql`${t.lactateThresholdPaceSPerKm} is null or ${t.lactateThresholdPaceSPerKm} > 0`,
    ),
    check("capacity_pred_5k_pos", sql`${t.racePred5kS} is null or ${t.racePred5kS} > 0`),
    check("capacity_pred_10k_pos", sql`${t.racePred10kS} is null or ${t.racePred10kS} > 0`),
    check("capacity_pred_half_pos", sql`${t.racePredHalfS} is null or ${t.racePredHalfS} > 0`),
    check(
      "capacity_pred_marathon_pos",
      sql`${t.racePredMarathonS} is null or ${t.racePredMarathonS} > 0`,
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
