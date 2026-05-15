export type RecipeCategory = "capture" | "review" | "connector" | "planning";

export type Recipe = {
  id: string;
  title: string;
  category: RecipeCategory;
  schedule: string;
  description: string;
  prompt: string;
  required_tools: string[];
  required_connectors: string[];
};

export const recipes: Recipe[] = [
  {
    id: "onboarding",
    title: "Onboarding",
    category: "planning",
    schedule: "0 0 1 1 *",
    description:
      "Walks first-time users through filling in PROFILE.md, GOALS.md, and PRINCIPLES.md.",
    required_tools: ["fs_read", "fs_write", "mark_recipe_run"],
    required_connectors: [],
    prompt: `Walk the user through Body Intelligence onboarding.

Read PROFILE.md, GOALS.md, and PRINCIPLES.md via fs_read. Each will contain template content with embedded fill-in prompts inside HTML comments (<!-- ... -->).

Greet the user warmly. Briefly explain the three files you'll fill out together — then go one at a time:

**PROFILE.md** — ask for: a one-paragraph self-description as an athlete, age, height, weight baseline, typical resting HR, current disciplines, training history (years + biggest blocks), and notable past injuries. Synthesize their answers into clean prose, preserve the section structure, remove the fill-in comments, fs_write the result.

**GOALS.md** — ask for: 1-3 PRs/PBs they care about and any upcoming races (name, date, tier, goal). Help them format race blocks correctly — the race-countdown recipe parses these. Don't pressure them to fill in races they don't have; an empty race section is fine. fs_write.

**PRINCIPLES.md** — this one is harder. Ask: "What's one rule you train by? Something specific enough that a coach who doesn't know you could follow it." Iterate until you have 3-5 principles across training, recovery, planning, and red flags. The defaults in the template are good starting points if they're stuck — read them aloud and ask if any feel right. fs_write.

After all three, briefly summarize what you learned about them and end with: "You can always update these — just tell me what changed, or open them directly. Want to install the morning check-in recipe next?"

This recipe is meant to be run once; the schedule is a placeholder. The /agents UI surfaces a "Run onboarding" button that triggers it via Cowork.`,
  },
  {
    id: "morning-checkin",
    title: "Morning check-in",
    category: "capture",
    schedule: "0 7 * * *",
    description:
      "Asks for last night's sleep and today's wellness scales. Logs them via log_daily.",
    required_tools: ["log_daily", "fs_read", "mark_recipe_run"],
    required_connectors: [],
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
    description: "Prompts for any unlogged workouts and meals from the day.",
    required_tools: ["log_workout", "log_daily", "get_recent", "mark_recipe_run"],
    required_connectors: [],
    prompt: `It's evening. Help the user catch up on anything they didn't log during the day.

Call get_recent({days: 1, kinds: ["workouts", "daily"]}) to see what's already logged for today.

If no workout is logged but the user usually trains on this weekday (you can infer from the last 14 days), ask whether they trained today. If yes, prompt for: type, duration, distance, RPE. Call log_workout.

If today's daily_entry has no meal_notes, ask for a one-line summary of what they ate. Call log_daily with just meal_notes.

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
    required_tools: ["get_recent", "fs_read", "fs_write", "mark_recipe_run"],
    required_connectors: [],
    prompt: `Run a weekly training review.

1. Call get_recent({days: 7}) to pull this week's workouts, daily entries, and active health events.
2. Call get_recent({days: 28}) to pull the broader 4-week context for trends.
3. fs_read PRINCIPLES.md, GOALS.md, and CURRENT.md.
4. fs_list({ prefix: "daily/" }) to find this week's per-day vendor context files. fs_read each one written within the last 7 days for vendor-specific scores (Garmin training readiness, Whoop recovery, etc.) that don't live in the structured tables.

Write a brief review covering:
- Training load this week (workout count, total duration, perceived intensity from RPE)
- How the week compares to the 4-week trend (heavier, lighter, same)
- Recovery indicators: average HRV, RHR, sleep, fatigue scale trend, plus any vendor-side signals (e.g. Garmin readiness or training-status flags) from the daily/ files
- Active health flags from health_events
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
      "Daily ingest of Garmin sleep, vitals, and movement into BI's structured tables; vendor scores go into daily/YYYY-MM-DD.md.",
    required_tools: ["log_daily", "log_workout", "fs_write", "fs_read", "mark_recipe_run"],
    required_connectors: ["garmin"],
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

**4. Workouts.** For each activity Garmin reports for DATE, call log_workout(date=DATE, type=<lowercased activity type>, duration_min, distance_km if applicable, avg_hr, max_hr, source='garmin', source_id=<Garmin activity id>). The source_id makes the write idempotent — re-runs upsert.

**5. Confirm.** Send the user one short line summarising what was synced. No editorialising on the numbers — that's the morning check-in's job.

**6. Mark the run.** Call mark_recipe_run(recipe_id="garmin-sync", status="ok"). On error, pass status="failed" and a short error message.`,
  },
  {
    id: "strava-sync",
    title: "Strava sync",
    category: "connector",
    schedule: "30 7 * * *",
    description:
      "Daily ingest of Strava activities as workouts. Idempotent via source_id.",
    required_tools: ["log_workout", "mark_recipe_run"],
    required_connectors: ["strava"],
    prompt: `Sync yesterday's Strava activities into Body Intelligence.

Call get_setup_guide once at the start.

**Decide the date.** Run for yesterday in the user's timezone. Call this DATE.

**1. Pull Strava activities for DATE.** From the Strava connector MCP, fetch every activity whose local start date is DATE.

**2. For each activity, call log_workout** with:
- date = DATE
- type = Strava activity type, lowercased, normalised to BI vocabulary:
  - 'Run' → 'run'
  - 'TrailRun' → 'trail_run'
  - 'Ride' / 'VirtualRide' → 'ride'
  - 'Swim' → 'swim'
  - 'Walk' / 'Hike' → 'walk' or 'hike'
  - 'WeightTraining' → 'lift'
  - others: lowercase and snake_case
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
    id: "health-log-audit",
    title: "Health-log audit",
    category: "review",
    schedule: "0 17 * * 1/14",
    description:
      "Reviews active health events and asks if any should be marked resolved.",
    required_tools: ["get_recent", "fs_read", "fs_write", "mark_recipe_run"],
    required_connectors: [],
    prompt: `Audit the user's active health events.

1. Call get_recent({days: 60, kinds: ["health_events"]}) — this returns unresolved events older than the window too.
2. fs_read HEALTH_LOG.md.

For each unresolved event:
- Note its date logged and most recent reference
- Ask the user briefly: "Still tracking the L-knee twinge from 3 weeks ago? Resolved, ongoing, or worse?"

Based on their replies, update HEALTH_LOG.md with resolution notes (date, what helped, lessons learned). Use fs_write.

If there are no active events, send a one-liner ("Health log clear, nothing to audit") and exit.

After everything else, call mark_recipe_run(recipe_id="health-log-audit", status="ok").`,
  },
];

export function getRecipe(id: string): Recipe | undefined {
  return recipes.find((r) => r.id === id);
}
