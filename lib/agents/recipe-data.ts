export type RecipeCategory =
  | "autopilot"
  | "capture"
  | "review"
  | "connector"
  | "planning";

export type Recipe = {
  id: string;
  title: string;
  category: RecipeCategory;
  schedule: string;
  description: string;
  prompt: string;
  required_tools: string[];
  required_connectors: string[];
  /**
   * Capability tags this recipe provides (e.g. "ingest:garmin",
   * "checkin:morning"). User-authored recipe docs under recipes/ declare
   * `covers:` in YAML front-matter; when an installed user recipe's tags
   * fully cover a catalog recipe's tags, the /agents page badges the
   * catalog card "Covered by your <recipe>" instead of "not installed".
   * Deterministic tag intersection — no reasoning on the server.
   */
  covers: string[];
};

export const recipes: Recipe[] = [
  {
    id: "dawn-agent",
    title: "Dawn agent",
    category: "autopilot",
    schedule: "0 9 * * *",
    description:
      "The flagship daily pass: sync yesterday from your wearable, compute baselines + readiness gate, update injury threads, write today's briefing.",
    required_tools: [
      "get_setup_guide",
      "get_recipe_status",
      "log_daily",
      "log_workout",
      "get_baseline",
      "log_derived_daily",
      "list_health_events",
      "add_health_event_update",
      "log_health_event",
      "resolve_health_event",
      "fs_read",
      "fs_write",
      "mark_recipe_run",
    ],
    required_connectors: ["garmin"],
    covers: [
      "ingest:garmin",
      "ingest:strava",
      "checkin:morning",
      "review:evening",
      "race:countdown",
      "briefing:daily",
      "derived:daily",
    ],
    prompt: `Run the daily dawn pass: finalize yesterday, compute the derived layer, update open health threads, and brief today. One idempotent pass — safe to re-run.

Call get_setup_guide once at the start so field conventions are fresh.

**Phase 0 — guard.** get_recipe_status("dawn-agent"). If it already ran today with status ok, stop unless explicitly re-invoked. Set DATE_Y = yesterday, DATE_T = today, in the user's timezone (from Settings profile; fs_read PROFILE.md if unclear).

**Phase 1 — context.** fs_read PROFILE.md (zones, anthropometrics), GOALS.md (races, targets), PRINCIPLES.md (the user's gate thresholds and training rules — these OVERRIDE the defaults below wherever they conflict), CURRENT.md (active block).

**Phase 2 — sync DATE_Y from the wearable connector.**
- Vitals → log_daily(date=DATE_Y, ...): sleep_h + the four sleep-stage minutes, hrv_ms, rhr_bpm, spo2_avg_pct, respiration_avg_brpm, skin_temp_deviation_c, sleep_score, weight_kg (if a weigh-in exists), steps, active_calories, floors_climbed, intensity minutes. Also log_daily(DATE_T) with this morning's sleep + recovery vitals (movement totals stay null — they self-heal on tomorrow's run).
- Also capture, when the connector exposes them (all SCALARS, columns now): daily stress (get_stress) → stress_score; Body Battery (get_body_battery) → body_battery_morning/high/low/charged/drained; morning readiness (get_morning_training_readiness) → training_readiness_score; training status (get_training_status) → training_status (store the lowercase status string, e.g. "productive"); on a weigh-in day, body composition (get_body_composition / get_weigh_ins) → body_fat_pct, muscle_mass_kg, bone_mass_kg, body_water_pct. If the user logs them, get_blood_pressure → bp_systolic_mmhg/bp_diastolic_mmhg and get_hydration → hydration_ml. The Body Battery curve, the readiness factor breakdown, and the HRV-status label still go to daily/DATE_Y.md — only the scalar lands in a column.
- Activities → log_workout per activity with source + source_id (idempotent), canonical type (the server normalizes aliases), and the metrics object for sensor data: cadence_spm, gct_ms, gct_balance_pct_left, vertical oscillation/ratio, stride_len_m, te_aerobic/anaerobic, vendor_training_load, stamina start/end/min, decoupling_pct (compute first-half vs second-half efficiency for sessions ≥ 60 min), elevation, speeds. notes = qualitative commentary ONLY.
- For each activity also fetch and pass: HR zones (get_activity_hr_zones) → the zones object hr_z1_s…hr_z5_s (seconds in zone); for rides, power zones (get_activity_power_zones) → power_z1_s…power_z7_s; weather (get_activity_weather) → metrics.weather_temp_c (feels-like) + metrics.weather_humidity_pct; gear (get_activity_gear) → the workout's shoes field (canonical shoe name); for strength sessions, get_activity_exercise_sets → metrics.strength_volume_kg (Σ reps×load), with the per-exercise breakdown written to daily/DATE_Y.md.
- Vendor composite BREAKDOWNS (Body Battery hourly curve + charge/drain events, the Training Readiness factor list, the sleep-score factor breakdown, HRV-status label) → daily/DATE_Y.md via fs_write (fs_read first — full-document replace; preserve non-Garmin sections). The trendable scalars already went to columns above. Lap splits and vendor labels go here too.
- If a Strava connector is available, pull only activities the wearable never saw (phone-only recordings); skip mirrored duplicates.

**Phase 3 — derived layer.** Compute against the user's own history, not population norms:
- get_baseline(metric, window_days=30) for hrv_ms, rhr_bpm, sleep_h → z = (today − mean) / stdev.
- Sleep debt: trailing-7-day sum of max(0, sleep_need − sleep_h×60); use the vendor sleep need if available, else 450 min.
- Training load: call get_load_balance(days=90) → current.atl → acute_load_7d, current.ctl → chronic_load_28d (deterministic CTL/ATL — the gate decision below is still yours, not the load tool's).
- Illness composite: RED if ≥2 of {skin_temp_deviation_c ≥ +0.5, rhr_z ≥ +1, hrv_z ≤ −1, respiration elevated}; AMBER if exactly 1; GREEN otherwise.
- Readiness gate (the user's PRINCIPLES.md rules win; defaults): GREEN composite + hrv_z ≥ −0.5 + sleep debt < 180 + no acute thread → quality allowed. AMBER, or hrv_z in [−1, −0.5), or sleep debt 180–300 → easy/Z2 only. RED, or hrv_z < −1, or active acute thread, or sleep debt > 300 → rest.
- Write it FIRST — before the briefing prose (Phase 5): log_derived_daily(date=DATE_T, readiness_gate, gate_reason, illness_composite, the four signal flags, hrv_z, rhr_z, sleep_z, sleep_debt_7d_min, sleep_need_min, acute_load_7d, chronic_load_28d, days_to_race if GOALS.md has a race, computed_by="dawn-agent"). This is the load-bearing structured output the dashboard hero renders as the readiness gate, so write it as soon as the gate is computed — even a partial run then leaves today's gate. Full-row replace (idempotent) — pass everything you computed each run. Optionally refresh BASELINES.md as the narrative substrate.

**Phase 4 — health threads.** list_health_events(active_only=true). For each: check today's signals, then add_health_event_update(event_id, date=DATE_T, note, severity_at_time) — never append status text into the event's notes. Update next_milestone/next_milestone_date via update_health_event when a checkpoint is set or moves — always set it for an awaited result (e.g. an MRI/scan) with its due date, so the dashboard surfaces it and flags it OVERDUE once the date passes rather than only mentioning it in prose. resolve_health_event(id, note) when the resolution gate is met. Open a NEW event when the illness composite trips RED or a session's metrics flag tissue risk (e.g. GCT asymmetry > 5% after a hard run on an injured side).

**Phase 5 — briefing.** Write briefings/DATE_T.md: (1) today's call + the one-line gating reason, (2) recovery snapshot (sleep, HRV z, RHR z, composite, sleep debt), (3) yesterday in one line, (4) trends worth watching, (5) open threads + next milestone, (6) a confidence note on any wearable-estimated signal. Keep it scannable. Send the user the top section as a short message.

**Phase 6 — close.** mark_recipe_run(recipe_id="dawn-agent", status="ok") — or "failed" with a short error.`,
  },
  {
    id: "onboarding",
    title: "Onboarding",
    category: "planning",
    schedule: "0 0 1 1 *",
    description:
      "Walks first-time users through filling in PROFILE.md, GOALS.md, and PRINCIPLES.md.",
    required_tools: ["fs_read", "fs_write", "mark_recipe_run"],
    required_connectors: [],
    covers: ["onboarding"],
    prompt: `Walk the user through Body Intelligence onboarding.

Read PROFILE.md, GOALS.md, and PRINCIPLES.md via fs_read. Each will contain template content with embedded fill-in prompts inside HTML comments (<!-- ... -->).

Greet the user warmly. Briefly explain the three files you'll fill out together — then go one at a time:

**PROFILE.md** — ask for: a one-paragraph self-description as an athlete, age, height, weight baseline, typical resting HR, current disciplines, training history (years + biggest blocks), and notable past injuries. Synthesize their answers into clean prose, preserve the section structure, remove the fill-in comments, fs_write the result.

**GOALS.md** — ask for: 1-3 PRs/PBs they care about and any upcoming races (name, date, tier, goal). Help them format race blocks correctly — the race-countdown recipe parses these. Don't pressure them to fill in races they don't have; an empty race section is fine. fs_write.

**PRINCIPLES.md** — this one is harder. Ask: "What's one rule you train by? Something specific enough that a coach who doesn't know you could follow it." Iterate until you have 3-5 principles across training, recovery, planning, and red flags. The defaults in the template are good starting points if they're stuck — read them aloud and ask if any feel right. fs_write.

After all three, briefly summarize what you learned about them and end with: "You can always update these — just tell me what changed, or open them directly. Want to install the dawn agent next? It's the daily pass that syncs your wearable, computes your readiness gate, and writes a morning briefing. (No wearable? The morning check-in and evening reflection recipes are the manual path.)"

This recipe is meant to be run once; the schedule is a placeholder. The /agents UI surfaces a "Run onboarding" button that triggers it via Cowork.`,
  },
  {
    id: "morning-checkin",
    title: "Morning check-in",
    category: "capture",
    schedule: "0 7 * * *",
    description:
      "Asks for last night's sleep and today's wellness scales. Logs them via log_daily. The manual path — the dawn agent covers this for wearable users.",
    required_tools: ["log_daily", "fs_read", "mark_recipe_run"],
    required_connectors: [],
    covers: ["checkin:morning"],
    prompt: `It's morning. Ask the user a brief check-in to log their daily entry.

Read PROFILE.md (via fs_read) once at the start so you know the user's name and any logging preferences.

Ask them, in one short message, for:
- Sleep hours last night
- HRV and RHR if they've checked Garmin/Oura/etc. (skip if they don't have a wearable)
- Six 1-5 scales: fatigue, soreness, mood, stress, motivation, sleep_quality. **Always 5 = best, including for fatigue/soreness/stress.** Remind them of this if it's their first time.
- Any flags worth noting (sore knee, stomach off, etc.)

If they reply with partial info, log what they gave and don't push for the rest. Better to capture 60% than nothing.

Call log_daily with their date (today, in their timezone) and the fields they provided.

Confirm what was logged in one short line. Don't editorialize on the numbers — that's a different conversation.

After everything else, call mark_recipe_run(recipe_id="morning-checkin", status="ok") so the /agents page shows you ran. On failure, pass status="failed" with a short error string.`,
  },
  {
    id: "evening-reflection",
    title: "Evening reflection",
    category: "capture",
    schedule: "0 21 * * *",
    description: "Prompts for any unlogged workouts from the day.",
    required_tools: ["log_workout", "get_recent", "mark_recipe_run"],
    required_connectors: [],
    covers: ["review:evening"],
    prompt: `It's evening. Help the user catch up on anything they didn't log during the day.

Call get_recent({days: 1, kinds: ["workouts", "daily"]}) to see what's already logged for today.

If no workout is logged but the user usually trains on this weekday (you can infer from the last 14 days), ask whether they trained today. If yes, prompt for: type, duration, distance, RPE. Call log_workout.

Don't be pushy. If they say they didn't train or want to skip, drop it.

End with a single sentence about what was logged or "all caught up."

After everything else, call mark_recipe_run(recipe_id="evening-reflection", status="ok").`,
  },
  {
    id: "weekly-review",
    title: "Weekly review",
    category: "review",
    schedule: "0 18 * * 0",
    description:
      "Summarizes the week's training load and trends. Updates CURRENT.md with the takeaways.",
    required_tools: ["get_recent", "get_stats", "fs_read", "fs_write", "mark_recipe_run"],
    required_connectors: [],
    covers: ["review:weekly"],
    prompt: `Run a weekly training review.

1. Call get_recent({days: 7}) to pull this week's workouts, daily entries, active health events, and derived rows (the agent-computed gate / z-scores / sleep debt — included by default).
2. Call get_recent({days: 28}) to pull the broader 4-week context for trends. For specific aggregates use get_stats (e.g. metric='derived_sleep_debt_7d_min' or 'workout_vendor_training_load').
3. fs_read PRINCIPLES.md, GOALS.md, and CURRENT.md.
4. Only if derived rows are missing for the week, fall back to fs_list({ prefix: "daily/" }) + fs_read for vendor-side signals.

Write a brief review covering:
- Training load this week (workout count, total duration, vendor training load or RPE-weighted minutes)
- How the week compares to the 4-week trend (heavier, lighter, same)
- Recovery indicators: gate history for the week (how many green/amber/red days), average HRV, RHR, sleep, sleep-debt direction
- Active health flags from health_events, with each thread's latest update and next milestone
- One sentence on whether the week tracked toward GOALS.md

Then update CURRENT.md by replacing its "This week" section with the new review and pushing the old one to a "Previous weeks" section if there's space (keep CURRENT.md under 200 lines — archive older content out).

Use fs_write to save. Don't ask for permission — this is a scheduled review, not an interactive session.

After saving, call mark_recipe_run(recipe_id="weekly-review", status="ok").`,
  },
  {
    id: "race-countdown",
    title: "Race countdown",
    category: "planning",
    schedule: "0 8 * * *",
    description:
      "Active during the 14 days before any race in GOALS.md. Daily focus message.",
    required_tools: ["fs_read", "get_recent", "mark_recipe_run"],
    required_connectors: [],
    covers: ["race:countdown"],
    prompt: `Check whether the user is within 14 days of a race.

1. fs_read GOALS.md and look for race dates. **Sanity guard:** if the only race in GOALS.md is dated more than 5 years from today, treat the file as un-edited (the user kept the example placeholder) and exit silently. If no race is within 14 days, also exit silently.
2. fs_read PRINCIPLES.md for the user's tapering philosophy.
3. Call get_recent({days: 7}) for current state.

Send the user a brief message:
- Days to race
- One specific focus for today (taper-appropriate workout type or rest, hydration cue, sleep target)
- Any active health flags they should be aware of going into the race

Keep it under 100 words. This runs daily for two weeks — if it gets noisy, the user disables it.

After sending, call mark_recipe_run(recipe_id="race-countdown", status="ok"). If you exited silently because no race is within 14 days, still call mark_recipe_run(recipe_id="race-countdown", status="ok") so the user sees the recipe is alive.`,
  },
  {
    id: "garmin-sync",
    title: "Garmin sync",
    category: "connector",
    schedule: "0 7 * * *",
    description:
      "Daily ingest of Garmin sleep, vitals, and movement into BI's structured tables; vendor scores go into daily/YYYY-MM-DD.md. Sync only — the dawn agent does this plus the derived layer and briefing.",
    required_tools: ["log_daily", "log_workout", "fs_write", "fs_read", "mark_recipe_run"],
    required_connectors: ["garmin"],
    covers: ["ingest:garmin"],
    prompt: `Sync yesterday's Garmin Connect data into Body Intelligence.

Call get_setup_guide once at the start so the field conventions are fresh — especially the rule that structured fields NEVER go into sleep_notes / wellness_notes prose.

**Decide the date.** Run for yesterday in the user's timezone (fs_read PROFILE.md if you need it). Call this DATE.

**1. Pull Garmin data for DATE.** From the Garmin connector MCP, fetch:
- Sleep: total hours + deep/light/REM/awake minutes
- HRV, RHR, SpO2 avg, respiration avg
- Weight (if a weigh-in exists)
- Steps, active calories, floors climbed, intensity minutes (moderate + vigorous)
- Body Battery morning / max / min / charged / drained
- Training Readiness score + key contributors (sleep, HRV status, recovery time, training load focus)
- Activities (workouts) for the day

**2. Write the structured row.** Call log_daily(date=DATE, ...) with EVERY universal vital that has a value:
- sleep_h, sleep_deep_min, sleep_light_min, sleep_rem_min, sleep_awake_min
- hrv_ms, rhr_bpm, spo2_avg_pct, respiration_avg_brpm
- skin_temp_deviation_c, sleep_score
- weight_kg (only if a weigh-in exists)
- steps, active_calories, floors_climbed, intensity_min_moderate, intensity_min_vigorous

Do NOT put sleep stages into sleep_notes. Do NOT put HRV/RHR into prose. Each of those has a column.

**3. Write the vendor scores to daily/YYYY-MM-DD.md.** Compose a markdown file with sections for Body Battery, Training Readiness, and any other Garmin-proprietary scores. Use fs_read first to see if a file already exists (e.g. from a prior partial sync); if it does, preserve any non-Garmin content and update the Garmin block in place. Example shape:

\`\`\`
# Vendor scores · DATE

## Garmin

### Body Battery
- Morning: 56
- Day max: 72
- Day min: 14
- Charged: 41
- Drained: 49

### Training Readiness
- Score: 64 / Status: Moderate
- Sleep score: 80
- HRV status: Balanced
- Recovery time: 18 h
- Training load focus: Aerobic base
\`\`\`

Then fs_write that path. If a prior sync exists for the same date, overwrite the Garmin section but keep other vendor sections.

**4. Workouts.** For each activity Garmin reports for DATE, call log_workout(date=DATE, type=<activity type — the server normalizes to the canonical vocabulary>, duration_min, distance_km if applicable, avg_hr, max_hr, source='garmin', source_id=<Garmin activity id>). The source_id makes the write idempotent — re-runs upsert.

Pass sensor data in the metrics object, NOT in notes: cadence_spm, gct_ms, gct_balance_pct_left, vertical_oscillation_mm, vertical_ratio_pct, stride_len_m, te_aerobic, te_anaerobic, vendor_training_load, stamina_start/end/min_pct, elevation_gain_m/loss_m, avg/max_speed_kmh. notes carries qualitative commentary only. Lap splits and vendor TE labels go in daily/DATE.md.

Garmin golf rounds do NOT appear in the activities list — query list_golf_rounds separately and log each round as type='golf' with source_id=<scorecard id>; the scorecard table goes in daily/DATE.md.

**5. Confirm.** Send the user one short line summarising what was synced. No editorialising on the numbers — that's the morning check-in's job.

**6. Mark the run.** Call mark_recipe_run(recipe_id="garmin-sync", status="ok"). On error, pass status="failed" and a short error message.`,
  },
  {
    id: "strava-sync",
    title: "Strava sync",
    category: "connector",
    schedule: "30 7 * * *",
    description:
      "Daily ingest of Strava activities as workouts. Idempotent via source_id. Fallback for activities your primary wearable never saw.",
    required_tools: ["log_workout", "mark_recipe_run"],
    required_connectors: ["strava"],
    covers: ["ingest:strava"],
    prompt: `Sync yesterday's Strava activities into Body Intelligence.

Call get_setup_guide once at the start.

**Decide the date.** Run for yesterday in the user's timezone. Call this DATE.

**1. Pull Strava activities for DATE.** From the Strava connector MCP, fetch every activity whose local start date is DATE.

**2. For each activity, call log_workout** with:
- date = DATE
- type = Strava activity type ('Run' → 'run', 'TrailRun' → 'trail_run', 'Ride'/'VirtualRide' → 'ride', 'WeightTraining' → 'strength', 'Walk'/'Hike' → 'walk'/'hike'). The server normalizes aliases to the canonical vocabulary anyway, so pass what Strava gives you.
- duration_min = elapsed_time / 60 (rounded)
- distance_km = distance_meters / 1000 (only if > 0)
- avg_hr, max_hr (if recorded)
- source = 'strava'
- source_id = Strava activity id
- notes = ONLY qualitative commentary the user wrote on Strava (the activity description). Do NOT dump distance / pace / HR into notes — those have columns.

**3. RPE.** Strava doesn't expose RPE. Leave it null unless the activity description includes an explicit "RPE N" hint, in which case parse it out.

**4. Detect misclassifications.** If duration_min < 5 AND type == 'run' (or trail_run), flag it — these are almost always walking gaps mis-tagged. Log it with type='walk' instead and mention the reclassification in the confirmation line. (The user can fix individual ones via update_workout later.)

**5. Confirm.** One short line summarising activity count and total minutes.

**6. Mark the run.** Call mark_recipe_run(recipe_id="strava-sync", status="ok"). On error, pass status="failed".`,
  },
  {
    id: "capacity-sync",
    title: "Capacity sync",
    category: "connector",
    schedule: "0 8 * * 1",
    description:
      "Weekly ingest of slow-moving fitness capacity from your wearable — VO2max, lactate threshold, FTP, endurance/hill score, fitness age, race predictions — into capacity_metrics, and refreshes THRESHOLDS.md (zones) and RECORDS.md (PRs).",
    required_tools: [
      "get_setup_guide",
      "get_recipe_status",
      "log_capacity",
      "fs_read",
      "fs_write",
      "mark_recipe_run",
    ],
    required_connectors: ["garmin"],
    covers: ["capacity:sync", "thresholds:zones", "records:prs"],
    prompt: `Sync this week's fitness-capacity snapshot from the wearable connector into Body Intelligence. One idempotent pass — safe to re-run.

Call get_setup_guide once. Set DATE = today in the user's timezone (fs_read PROFILE.md if unclear).

**Phase 0 — guard.** get_recipe_status("capacity-sync"); if it ran ok in the last 5 days, stop unless explicitly re-invoked.

**Phase 1 — fetch capacity from the connector** (skip any the connector doesn't expose; never invent a value):
- VO2max: get_vo2_max → vo2max_running, vo2max_cycling
- Lactate threshold: get_lactate_threshold → lactate_threshold_hr_bpm, lactate_threshold_pace_s_per_km (convert pace to seconds/km — 4:00/km = 240), and cycling LT power if present → lactate_threshold_power_w
- Cycling FTP: get_cycling_ftp → cycling_ftp_w
- Endurance score: get_endurance_score → endurance_score
- Hill score: get_hill_score → hill_score
- Fitness age: get_fitness_age → fitness_age_years
- Running tolerance: get_running_tolerance → running_tolerance_km
- Race predictions: get_race_predictions → race_pred_5k_s, race_pred_10k_s, race_pred_half_s, race_pred_marathon_s (all in seconds)

**Phase 2 — write the snapshot.** Call log_capacity(date=DATE, ...every value you have). Partial-merge by (user, date) — a re-run the same week patches the same row. Leave a metric out if the connector didn't return it.

**Phase 3 — derive zones into THRESHOLDS.md.** fs_read THRESHOLDS.md first (preserve user edits and section shapes — recipes parse them). Using the user's PRINCIPLES.md zone model (or standard %LTHR / %FTP if none), translate the captured LTHR / threshold pace / FTP into the fixed THRESHOLDS.md blocks. YOU compute the zones — BI stores nothing derived here. fs_write the result.

**Phase 4 — personal records.** get_personal_record (and get_progress_summary for context). Update RECORDS.md's parseable PR blocks for any new bests, keeping one block per record. fs_write.

**Phase 5 — close.** Send the user one short line noting any meaningful capacity move (e.g. "VO2max 52→53, predicted HM −22s"). No verdicts. mark_recipe_run(recipe_id="capacity-sync", status="ok") — or "failed" with a short error.`,
  },
  {
    id: "backfill",
    title: "Backfill (one-shot)",
    category: "connector",
    schedule: "0 0 1 1 *",
    description:
      "One-time rehydration: iterate your last 90 days of Garmin workouts and pull HR zones, vendor load, running dynamics, decoupling, and weather into the structured columns, plus seed capacity history — so training load switches from the crude RPE fallback to zone-TRIMP and the empty Analyze bands (Intensity, Fitness & capacity, Heat→decoupling) light up retroactively.",
    required_tools: [
      "get_setup_guide",
      "list_workouts",
      "get_workout",
      "update_workout",
      "log_capacity",
      "mark_recipe_run",
    ],
    required_connectors: ["garmin"],
    covers: ["backfill:garmin"],
    prompt: `One-shot backfill: rehydrate structured workout metrics/zones + capacity from Garmin for data you already logged. Idempotent — safe to re-run, and it only UPDATES existing rows (never creates workouts).

Call get_setup_guide once.

**Phase 1 — enumerate.** list_workouts(from_date = 90 days ago, to_date = today). Keep the rows with source='garmin' and a source_id (the Garmin activity id).

**Phase 2 — per workout** (skip ones that already have zones — get_workout to check):
- From the Garmin connector: get_activity_hr_zones(activity_id) → zones{hr_z1_s…hr_z5_s}; for rides get_activity_power_zones → power_z*_s. get_activity_details(activity_id) → metrics{vendor_training_load, cadence_spm, gct_ms, gct_balance_pct_left, vertical oscillation/ratio, stride_len_m, te_aerobic/anaerobic, stamina, decoupling_pct (first-half vs second-half efficiency for efforts ≥ 60 min)}. get_activity_weather → metrics{weather_temp_c (feels-like), weather_humidity_pct}.
- update_workout(id, metrics={…}, zones={…}). Full-replace upsert of both side tables — idempotent by workout id. Do NOT create new workouts; only update existing rows.

**Phase 3 — capacity history.** Pull get_vo2_max / get_cycling_ftp / get_lactate_threshold / get_race_predictions and log_capacity(date, …) for the most recent snapshot (and any weekly history the connector exposes). Convert paces/predictions to seconds.

**Phase 4 — close.** Report how many workouts were backfilled and confirm the Analyze load band now shows zone-TRIMP instead of RPE-estimated. mark_recipe_run(recipe_id="backfill", status="ok") — or "failed" with a short error.`,
  },
  {
    id: "health-log-audit",
    title: "Health-log audit",
    category: "review",
    schedule: "0 17 * * 1/14",
    description:
      "Reviews active health events and asks if any should be marked resolved.",
    required_tools: ["get_recent", "resolve_health_event", "fs_read", "fs_write", "mark_recipe_run"],
    required_connectors: [],
    covers: ["health:audit"],
    prompt: `Audit the user's active health events.

1. Call get_recent({days: 60, kinds: ["health_events"]}) — this returns unresolved events older than the window too.
2. fs_read HEALTH_LOG.md.

For each unresolved event:
- Note its date logged, latest thread update, and next milestone if set
- Ask the user briefly: "Still tracking the L-knee twinge from 3 weeks ago? Resolved, ongoing, or worse?"

Based on their replies: resolve_health_event(id, note=<what cleared it / lessons>) for finished events, add_health_event_update for status changes, and update HEALTH_LOG.md with the narrative block (mechanism, treatment, resolution, lessons). Use fs_write.

If there are no active events, send a one-liner ("Health log clear, nothing to audit") and exit.

After everything else, call mark_recipe_run(recipe_id="health-log-audit", status="ok").`,
  },
  {
    id: "insights",
    title: "Insights scan",
    category: "review",
    schedule: "0 19 * * 0",
    description:
      "Weekly statistical scan: reads the deterministic stats engine (correlations, trends, CTL/ATL/TSB, distributions) and writes a plain-language interpretation to insights/YYYY-Www.md — the 'what to optimize' reasoning the app deliberately never does itself.",
    required_tools: [
      "get_setup_guide",
      "get_recipe_status",
      "get_correlation_matrix",
      "get_correlation",
      "get_trend",
      "get_load_balance",
      "get_distribution",
      "get_metric_series",
      "fs_read",
      "fs_write",
      "mark_recipe_run",
    ],
    required_connectors: [],
    covers: ["insights:weekly"],
    prompt: `Run the weekly insights scan. BI computes the statistics; YOU do the reasoning the app never does — what's moving, what relates to what, what to optimize. Write it to insights/YYYY-Www.md.

Call get_setup_guide once. Set WEEK = the current ISO week (e.g. 2026-W27) and a 90-day window.

**Phase 0 — guard.** get_recipe_status("insights"); if it ran ok in the last 5 days, stop unless re-invoked.

**Phase 1 — context.** fs_read PRINCIPLES.md (the rules you reason against), GOALS.md (what the user is optimizing for), CURRENT.md (active block).

**Phase 2 — read the stats engine** (all deterministic — these return numbers, never verdicts):
- get_load_balance(days=90) → CTL/ATL/TSB trajectory and current form.
- get_correlation_matrix(metrics=[hrv_ms, rhr_bpm, sleep_h, derived_sleep_debt_7d_min, derived_acute_load_7d, soreness, weight_kg], window_days=90) → the relationships that are real for THIS athlete.
- get_trend(metric, window_days=90) for the metrics that matter to GOALS.md (e.g. capacity_vo2max_running, weight_kg, hrv_ms, workout_cadence_spm).
- get_distribution(metric, window_days=90) for any metric whose spread you want to characterize.
- get_correlation(a, b, lag_days=1) to probe specific dose→response ideas (e.g. acute load → next-day HRV).

**Phase 3 — interpret and write insights/WEEK.md.** This is the judgment layer the app omits. Cover: (1) the single biggest signal this week, (2) 2–4 relationships worth acting on (with the r and n, and a caveat that correlation isn't causation), (3) load/form read from CTL/ATL/TSB against the user's PRINCIPLES.md, (4) one concrete thing to optimize next, (5) what the data can't yet say (low n, missing capture). Keep it scannable; cite the numbers. fs_read insights/WEEK.md first if it exists; full-document replace.

**Phase 4 — close.** Send the user the top takeaway as a short message. mark_recipe_run(recipe_id="insights", status="ok") — or "failed" with a short error.`,
  },
];

export function getRecipe(id: string): Recipe | undefined {
  return recipes.find((r) => r.id === id);
}
