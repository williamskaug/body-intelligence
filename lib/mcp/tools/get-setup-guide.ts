import { z } from "zod";

// Empty input — tool takes no arguments. Defined as a Zod object for the SDK
// so the generated JSON Schema is `{ type: 'object', properties: {} }` rather
// than missing entirely.
export const getSetupGuideInputSchema = {} as const;

export const getSetupGuideInputZod = z.object({});

export const SETUP_GUIDE = `Body Intelligence (BI) is the user's personal health intelligence store —
workouts, daily wellness, meals, health events, and a markdown memory layer.
Same shape as Project Intelligence, but for the athlete-self.

# The passive principle

BI is a passive store. It holds data and returns data. It does NOT decide whether the
user should train, rest, take a recovery week, or push through. Those judgments are
yours, made by reasoning over the data plus the user's PRINCIPLES.md. Do not delegate
decisions to BI — there is no logic on the server side beyond CRUD.

# Data model

- workouts — one row per workout. type uses a CANONICAL vocabulary: run,
  trail_run, ride, gravel_ride, mtb, golf, strength, walk, hike, swim, row,
  yoga, mobility, xc_ski, orienteering, padel, other. Aliases normalize
  server-side ('running'→'run', 'road_biking'→'ride', 'WeightTraining'→
  'strength'); unknown types pass through lowercased + snake_cased.
  Optional duration_min, distance_km, avg_hr, max_hr, rpe (1–10), shoes, notes.
- workout_metrics — optional 1:1 sensor metrics per workout, written via the
  nested metrics object on log_workout / bulk_log_workouts / update_workout:
  cadence_spm, gct_ms, gct_balance_pct_left, vertical oscillation/ratio,
  stride_len_m, te_aerobic/anaerobic, vendor_training_load, stamina
  start/end/min, decoupling_pct, elevation gain/loss, avg/max speed.
  Full replace per workout. Lap splits + vendor labels stay in daily/*.md.
- daily_entries — one row per (user, date). Universal vitals (sleep_h, four
  sleep-stage minutes, hrv_ms, rhr_bpm, spo2_avg_pct, respiration_avg_brpm,
  skin_temp_deviation_c, sleep_score), body composition (weight_kg,
  body_fat_pct), movement totals (steps, active_calories, floors_climbed,
  intensity_min_moderate, intensity_min_vigorous), six 1–5 wellness scales,
  and three free-text blocks (sleep_notes, wellness_notes, meal_notes).
  Partial updates allowed — write whatever the source has, leave the rest.
  Vendor-proprietary composites (Body Battery, Readiness, Recovery) do NOT
  belong here — they go in daily/YYYY-MM-DD.md.
- derived_daily — one row per (user, date), written ONLY by your scheduled
  agent via log_derived_daily (BI never computes anything): readiness_gate
  green/amber/red + gate_reason, illness_composite + per-signal flags
  (skin_temp/hrv/rhr/resp), hrv_z/rhr_z/sleep_z, sleep_debt_7d_min,
  sleep_need_min, acute_load_7d, chronic_load_28d, days_to_race.
  FULL-ROW REPLACE per date (opposite of log_daily's merge). The dashboard
  renders today's gate from this table — keep it fresh from the daily recipe.
- meals — one row per meal. Supported but OPTIONAL — only prompt for meals if
  the user has been logging them; day-level food prose can go in
  daily_entries.meal_notes if the user volunteers it. When writing a meal,
  calories + protein_g + carbs_g + fat_g are required (estimate from the
  description if no authoritative source). Dietary philosophy: NUTRITION.md.
- health_events — injuries / illnesses / symptoms. kind is one of
  'injury' | 'illness' | 'symptom'. resolved_date null = still active.
  notes = the stable summary (mechanism, hypothesis, management plan).
  Dated status updates go through add_health_event_update — a thread of
  (date, note, severity_at_time) rows — NEVER appended into notes.
  next_milestone / next_milestone_date hold the checkpoint gating
  progression (e.g. 'MRI — structural clearance gate', 2026-06-23).
  Resolve via resolve_health_event (optionally with a closing note).
- documents — virtual filesystem keyed by (user, path). Markdown content. Eight
  standard paths seeded on signup (see Memory layer below).

# Conventions — read these before writing

- **NEVER dump a structured field into a prose field.** If the source has
  deep/light/REM/awake sleep minutes, write them to sleep_deep_min /
  sleep_light_min / sleep_rem_min / sleep_awake_min — NOT into sleep_notes
  prose. Same for HRV, RHR, weight, body fat, steps, active calories, every
  vital — and same for running dynamics: cadence, GCT balance, training
  effect, stamina go in the metrics object on log_workout, not in workout
  notes. sleep_notes / wellness_notes / meal_notes / workout notes are for
  QUALITATIVE commentary only ("woke once at 3am", "knee felt tight the
  first mile"), not as a dump zone for values that have homes.
- Vendor-proprietary scores (Garmin Body Battery, Whoop Recovery, Oura
  Readiness) belong in daily/YYYY-MM-DD.md via fs_write — not in
  sleep_notes, not as new columns. Universal vitals (sleep_h, hrv_ms,
  rhr_bpm, sleep_deep_min, etc.) still go in daily_entries.
- Wellness scales (fatigue, soreness, mood, stress, motivation, sleep_quality) use
  5 = best, ALWAYS. Even for fatigue / soreness / stress — 5 means "no fatigue",
  "no soreness", "no stress". The naming is inverted relative to natural reading.
- health_events.severity is the OPPOSITE direction: 1–5 with 5 = most severe.
  This is the one place where 5 = bad. Don't confuse it with the wellness scales.
- rpe is 1–10 (standard Borg-style RPE), not 1–5.
- Idempotency: workouts and meals accept (source, source_id). Manual writes leave
  source_id null and always insert. Connector recipes (Garmin, Strava, MFP, …)
  set source='garmin' + source_id=<external id> so re-runs upsert cleanly.
- Dates are stored as DATE in the user's local sense — no timezone conversion on
  the server. eaten_at on meals is the only true timestamp.
- All writes are user-scoped automatically. Tools never accept a user_id argument.
- Full CRUD is available through MCP. log_* tools insert/upsert; update_* tools
  patch existing rows by id; delete_* tools hard-delete. Daily entries don't
  have an update_* — log_daily already serves as both create and update via
  the (user, date) upsert. Prefer update over delete when correcting bad
  data — deletion loses history. Resolve a health event by calling
  update_health_event with resolved_date, not by deleting it.

# Memory layer

Eight standard markdown documents per user, seeded on signup:

- MEMORY.md     — one-line index over the other files
- PROFILE.md    — anthropometrics, training history, equipment
- PRINCIPLES.md — training philosophy; the decision rules you reason against
- GOALS.md      — A/B/C races, performance benchmarks
- CURRENT.md    — this week's plan, active block, next race
- HEALTH_LOG.md — narrative history of injuries / illnesses / niggles
- NUTRITION.md  — what works, what wrecks them, dietary preferences
- EQUIPMENT.md  — gear inventory, mileage, condition

The documents table is a virtual filesystem. Paths are slash-separated and end
in .md. Folders are implicit — you create them by writing to a nested path.
Use folders liberally to organize the user's memory:

- daily/YYYY-MM-DD.md         — per-day vendor data, body battery, anomalies
- notes/<topic>.md            — thematic notes ('notes/altitude-camp-2026.md')
- weekly/YYYY-Www.md          — weekly-review outputs ('weekly/2026-W19.md')
- races/<race-slug>.md        — per-race planning + post-race debriefs
- recipes/<name>.md           — meals or fuelling notes the user wants saved

fs_list returns BOTH files (flat list) AND folders (derived from path
prefixes with file counts), so you can quickly see the user's existing
structure. Pass a prefix like 'notes/' to scope to a subtree. fs_move
renames or relocates a single file atomically; bulk reorganization is
done by enumerating with fs_list + moving each file.

Two format conventions matter because recipes parse them:
- GOALS.md race blocks: '## Race: <name>' then '- Date: YYYY-MM-DD' + Tier/Distance/Goal/Notes.
- HEALTH_LOG.md events: '## YYYY-MM-DD — <body part> — <kind>' then Mechanism/Severity/Treatment/Resolution/Lessons.

Per-day vendor data (Garmin / Whoop / Oura proprietary scores like Body Battery,
Recovery, Readiness) goes into 'daily/YYYY-MM-DD.md' via fs_write — not into the
tables. Canonical universal metrics (sleep_h, hrv_ms, rhr_bpm) still go in
daily_entries.

# Reasoning rhythm

The user invokes you through scheduled-agent recipes (dawn agent / morning
check-in, weekly review, race countdown, …) plus ad-hoc conversations.

At the start of a session, orient yourself by:
1. get_briefing() — today's (or the latest) agent-written briefing, plus
   get_recent(days=7) including kinds:['derived'] for the structured gate.
2. fs_read('CURRENT.md') and fs_read('PRINCIPLES.md') — the load-bearing context.
3. fs_read on the specific memory file the conversation touches (GOALS.md for
   race planning, NUTRITION.md for fueling, HEALTH_LOG.md for injuries).

Update memory files when you learn something durable (a new pattern, a resolved
injury, a goal change). Log structured rows when capturing today's data
(workouts, daily wellness, meals, new health events). Don't duplicate prose —
one canonical home per piece of information.

# When something feels off

If a scale value looks wrong, suspect the inverted-direction conventions before
suspecting bad data. If a write fails with a check-constraint error, you almost
certainly violated one of: wellness 1–5, severity 1–5, rpe 1–10, or health_event
kind in {injury, illness, symptom}.`;

export function getSetupGuide(): { guide: string } {
  return { guide: SETUP_GUIDE };
}
