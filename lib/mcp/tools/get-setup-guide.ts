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

- workouts — one row per workout. Free-form type (run / lift / ride / yoga / …).
  Optional duration_min, distance_km, avg_hr, max_hr, rpe (1–10), shoes, notes.
- daily_entries — one row per (user, date). Universal vitals (sleep_h, four
  sleep-stage minutes, hrv_ms, rhr_bpm, spo2_avg_pct, respiration_avg_brpm),
  body composition (weight_kg, body_fat_pct), movement totals (steps,
  active_calories, floors_climbed, intensity_min_moderate, intensity_min_vigorous),
  six 1–5 wellness scales, and three free-text blocks (sleep_notes,
  wellness_notes, meal_notes). Partial updates allowed — write whatever the
  source has, leave the rest. Vendor-proprietary scores (Body Battery,
  Readiness, Recovery) do NOT belong here — they go in daily/YYYY-MM-DD.md.
- meals — one row per meal. eaten_at (timestamp), meal_type, required description,
  REQUIRED calories + protein_g + carbs_g + fat_g (estimate from the description if
  no authoritative source is available — never skip a meal write to avoid
  estimating). fiber_g optional. Day-level prose lives in daily_entries.meal_notes;
  dietary philosophy lives in NUTRITION.md.
- health_events — injuries / illnesses / symptoms. kind is one of
  'injury' | 'illness' | 'symptom'. resolved_date null = still active.
  Use update_health_event with resolved_date to mark an event as past.
- documents — virtual filesystem keyed by (user, path). Markdown content. Eight
  standard paths seeded on signup (see Memory layer below).

# Conventions — read these before writing

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

Custom paths are allowed (e.g. 'notes/2026-altitude-camp.md', 'daily/2026-05-11.md').

Two format conventions matter because recipes parse them:
- GOALS.md race blocks: '## Race: <name>' then '- Date: YYYY-MM-DD' + Tier/Distance/Goal/Notes.
- HEALTH_LOG.md events: '## YYYY-MM-DD — <body part> — <kind>' then Mechanism/Severity/Treatment/Resolution/Lessons.

Per-day vendor data (Garmin / Whoop / Oura proprietary scores like Body Battery,
Recovery, Readiness) goes into 'daily/YYYY-MM-DD.md' via fs_write — not into the
tables. Canonical universal metrics (sleep_h, hrv_ms, rhr_bpm) still go in
daily_entries.

# Reasoning rhythm

The user invokes you through scheduled-agent recipes (morning check-in, evening
reflection, weekly review, race countdown, …) plus ad-hoc conversations.

At the start of a session, orient yourself by:
1. fs_read('CURRENT.md') and fs_read('PRINCIPLES.md') — the load-bearing context.
2. get_recent(days=7) for the structured data.
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
