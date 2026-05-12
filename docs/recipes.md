# Scheduled-Agent Recipes

Recipes are prompts plus a schedule. They're rendered on `/agents` as cards; users click *Install* and copy the prompt into their Cowork *New Scheduled Task* dialog. The BI app never executes these directly — Cowork does, against whatever Claude instance is configured there, using the BI MCP tools the user authorized.

## The Recipe type

```ts
type Recipe = {
  id: string;                       // kebab-case, stable
  title: string;                    // 4-6 words
  category: "capture" | "review" | "connector" | "planning";
  schedule: string;                 // cron expression, UTC unless documented otherwise
  description: string;              // one sentence on the card
  prompt: string;                   // the full prompt that runs each time
  required_tools: string[];         // BI MCP tool names this recipe calls
  required_connectors: string[];    // external Claude connectors needed (e.g. ["garmin"])
};
```

The `lib/agents/recipe-data.ts` file exports `recipes: Recipe[]`. Display order is array order — group by category in the source.

`required_connectors` powers the "Requires: Garmin" badges on the `/agents` cards. BI-only recipes (most of Phase 1) leave the array empty. Connector recipes list every external MCP they call.

## Quality bar for prompts

- **Self-contained.** A prompt should work for someone who has never read the BI codebase. Don't reference internal types or function signatures. Reference MCP tool names by their public names (`log_daily`, `fs_read`).
- **Graceful degradation.** "If `GOALS.md` doesn't exist, ask the user what they're training for" — never assume state.
- **Tight.** Under 500 words per prompt. Long prompts are hard to maintain and bloat token costs at runtime.
- **Reference memory files explicitly.** A recipe that wants to plan a workout should `fs_read("PRINCIPLES.md")` and `fs_read("CURRENT.md")` rather than improvising.
- **Output should land somewhere durable.** A weekly review that doesn't update `CURRENT.md` is a wasted run.

## Starter set (Phase 1)

Six recipes for the manual-capture MVP. Two more (Garmin sync, Strava sync) ship with Phase 2.

---

### 0. Onboarding

```ts
{
  id: "onboarding",
  title: "Onboarding",
  category: "planning",
  schedule: "0 0 1 1 *",                      // never auto-runs (Jan 1 00:00 — placeholder); user-triggered only
  description: "Walks first-time users through filling in PROFILE.md, GOALS.md, and PRINCIPLES.md.",
  required_tools: ["fs_read", "fs_write"],
  required_connectors: [],
  prompt: `Walk the user through Body Intelligence onboarding.

Read PROFILE.md, GOALS.md, and PRINCIPLES.md via fs_read. Each will contain template content with embedded fill-in prompts inside HTML comments (<!-- ... -->).

Greet the user warmly. Briefly explain the three files you'll fill out together — then go one at a time:

**PROFILE.md** — ask for: a one-paragraph self-description as an athlete, age, height, weight baseline, typical resting HR, current disciplines, training history (years + biggest blocks), and notable past injuries. Synthesize their answers into clean prose, preserve the section structure, remove the fill-in comments, fs_write the result.

**GOALS.md** — ask for: 1-3 PRs/PBs they care about and any upcoming races (name, date, tier, goal). Help them format race blocks correctly — the race-countdown recipe parses these. Don't pressure them to fill in races they don't have; an empty race section is fine. fs_write.

**PRINCIPLES.md** — this one is harder. Ask: "What's one rule you train by? Something specific enough that a coach who doesn't know you could follow it." Iterate until you have 3-5 principles across training, recovery, planning, and red flags. The defaults in the template are good starting points if they're stuck — read them aloud and ask if any feel right. fs_write.

After all three, briefly summarize what you learned about them and end with: "You can always update these — just tell me what changed, or open them directly. Want to install the morning check-in recipe next?"

This recipe is meant to be run once; the schedule is a placeholder. The /agents UI surfaces a "Run onboarding" button that triggers it via Cowork.`
}
```

---

### 1. Morning check-in

```ts
{
  id: "morning-checkin",
  title: "Morning check-in",
  category: "capture",
  schedule: "0 7 * * *",                      // 7am UTC; document local intent in description
  description: "Asks for last night's sleep and today's wellness scales. Logs them via log_daily.",
  required_tools: ["log_daily", "fs_read"],
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

Confirm what was logged in one short line. Don't editorialize on the numbers — that's a different conversation.`
}
```

---

### 2. Evening reflection

```ts
{
  id: "evening-reflection",
  title: "Evening reflection",
  category: "capture",
  schedule: "0 21 * * *",
  description: "Prompts for any unlogged workouts and meals from the day.",
  required_tools: ["log_workout", "log_daily", "get_recent"],
  required_connectors: [],
  prompt: `It's evening. Help the user catch up on anything they didn't log during the day.

Call get_recent({days: 1, kinds: ["workouts", "daily"]}) to see what's already logged for today.

If no workout is logged but the user usually trains on this weekday (you can infer from the last 14 days), ask whether they trained today. If yes, prompt for: type, duration, distance, RPE. Call log_workout.

If today's daily_entry has no meal_notes, ask for a one-line summary of what they ate. Call log_daily with just meal_notes.

Don't be pushy. If they say they didn't train or want to skip, drop it.

End with a single sentence about what was logged or "all caught up."`
}
```

---

### 3. Weekly review

```ts
{
  id: "weekly-review",
  title: "Weekly review",
  category: "review",
  schedule: "0 18 * * 0",                     // Sunday 6pm UTC
  description: "Summarizes the week's training load and trends. Updates CURRENT.md with the takeaways.",
  required_tools: ["get_recent", "fs_read", "fs_write"],
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

Use fs_write to save. Don't ask for permission — this is a scheduled review, not an interactive session.`
}
```

---

### 4. Race countdown

```ts
{
  id: "race-countdown",
  title: "Race countdown",
  category: "planning",
  schedule: "0 8 * * *",                      // daily 8am
  description: "Active during the 14 days before any race in GOALS.md. Daily focus message.",
  required_tools: ["fs_read", "get_recent"],
  required_connectors: [],
  prompt: `Check whether the user is within 14 days of a race.

1. fs_read GOALS.md and look for race dates. If no race is within 14 days, exit silently.
2. fs_read PRINCIPLES.md for the user's tapering philosophy.
3. Call get_recent({days: 7}) for current state.

Send the user a brief message:
- Days to race
- One specific focus for today (taper-appropriate workout type or rest, hydration cue, sleep target)
- Any active health flags they should be aware of going into the race

Keep it under 100 words. This runs daily for two weeks — if it gets noisy, the user disables it.`
}
```

---

### 5. Health-log audit

```ts
{
  id: "health-log-audit",
  title: "Health-log audit",
  category: "review",
  schedule: "0 17 * * 1/14",                  // every other Monday 5pm
  description: "Reviews active health events and asks if any should be marked resolved.",
  required_tools: ["get_recent", "fs_read", "fs_write"],
  required_connectors: [],
  prompt: `Audit the user's active health events.

1. Call get_recent({days: 60, kinds: ["health_events"]}) — this returns unresolved events older than the window too.
2. fs_read HEALTH_LOG.md.

For each unresolved event:
- Note its date logged and most recent reference
- Ask the user briefly: "Still tracking the L-knee twinge from 3 weeks ago? Resolved, ongoing, or worse?"

Based on their replies, update HEALTH_LOG.md with resolution notes (date, what helped, lessons learned). Use fs_write.

If there are no active events, send a one-liner ("Health log clear, nothing to audit") and exit.`
}
```

---

### Phase 2 — connector recipes

These compose external Claude connectors (Garmin, Strava, etc.) with the BI MCP. BI itself does not ingest data; these recipes orchestrate the read-from-connector → write-to-BI flow at conversation time. The recipe will fail at runtime if the required connector isn't connected to Cowork — that's by design (see `docs/architecture.md` § *Integrations are not BI's problem*).

#### 6. Garmin sync

```ts
{
  id: "garmin-sync",
  title: "Garmin sync",
  category: "connector",
  schedule: "0 7 * * *",                    // daily 7am
  description: "Pulls yesterday's sleep, vitals, body composition, movement totals, and activities from Garmin and persists them to BI.",
  required_tools: ["log_daily", "log_workout", "fs_write", "fs_read", "get_recent"],
  required_connectors: ["garmin"],
  prompt: `Sync yesterday's Garmin data into Body Intelligence.

You have access to two MCPs: a Garmin connector and the Body Intelligence (BI) MCP.

1. Determine yesterday's date in the user's timezone (read PROFILE.md via fs_read for their timezone if you don't know it).

2. From the Garmin connector, fetch yesterday's:
   - Sleep summary: total duration AND deep/light/REM/awake minutes, plus sleep score
   - Morning HRV
   - Resting heart rate
   - Overnight SpO2 average and respiration rate average
   - Daily steps, active calories, floors climbed
   - Weekly intensity minutes (extract yesterday's moderate + vigorous slice)
   - Latest weigh-in (weight + body fat % if smart scale connected)
   - All activities (one entry per activity)
   - Vendor-specific scores: training readiness, training status, body battery range, VO2 max, race predictions

3. Call BI's log_daily with yesterday's date and all the universal fields fetched in step 2 — sleep_h, sleep_deep_min, sleep_light_min, sleep_rem_min, sleep_awake_min, hrv_ms, rhr_bpm, spo2_avg_pct, respiration_avg_brpm, weight_kg, body_fat_pct, steps, active_calories, floors_climbed, intensity_min_moderate, intensity_min_vigorous. Skip fields Garmin didn't return; log_daily accepts partial input. The upsert is on (user_id, date), so this is safe to re-run, and manually-logged fields like fatigue/mood will not be overwritten because log_daily preserves untouched fields.

4. For each Garmin activity, call BI's log_workout with:
   - source: "garmin"
   - source_id: the Garmin activity ID (this makes the write idempotent — re-running this recipe will update, not duplicate)
   - type: a clean lowercase label derived from Garmin's activity type ("running" → "run", "cycling" → "ride", etc.)
   - duration_min, distance_km, avg_hr, max_hr from the activity
   - notes: any Garmin-provided activity title or description

5. Write the vendor-specific context as a markdown document. Call fs_write({ path: "daily/<YYYY-MM-DD>.md", content: "..." }) with a Garmin section containing the proprietary scores from step 2 — training readiness, training status, body battery, VO2 max, sleep score, anything else worth capturing. If the file already exists (Whoop or Oura sync wrote first), fs_read it first and merge — keep other vendors' sections intact. The weekly-review recipe reads these files when synthesizing trends.

6. End with a one-line summary of what was synced. Do not editorialize on the data.

If the Garmin connector returns no data for yesterday (rest day, watch off charger), exit silently — don't write empty entries.`
}
```

#### 7. Strava sync

```ts
{
  id: "strava-sync",
  title: "Strava sync",
  category: "connector",
  schedule: "0 7 * * *",                    // daily 7am — runs after Garmin if both installed
  description: "Pulls yesterday's outdoor activities from Strava and persists them to BI.",
  required_tools: ["log_workout", "fs_write", "fs_read", "get_recent"],
  required_connectors: ["strava"],
  prompt: `Sync yesterday's Strava activities into Body Intelligence.

You have access to a Strava connector and the BI MCP.

1. Determine yesterday's date in the user's timezone (read PROFILE.md if needed).

2. From the Strava connector, fetch yesterday's activities (with segment efforts and any Strava-side metrics like relative effort / suffer score if available).

3. For each activity, call BI's log_workout with:
   - source: "strava"
   - source_id: the Strava activity ID (idempotent re-runs)
   - type: lowercase clean label ("Run" → "run", "Ride" → "ride")
   - duration_min, distance_km, avg_hr, max_hr
   - notes: the Strava activity title plus a brief description if present

4. If any Strava-side scores worth capturing came back (relative effort, suffer score, segment PRs, kudos count), write them into daily/<YYYY-MM-DD>.md under a "Strava" section. fs_read first to merge with other vendors' sections if the file exists.

5. **Deduplication note for users with both Garmin and Strava:** Strava activities often originate from Garmin and will already have been written by the Garmin sync recipe with source: "garmin". The unique constraint is on (user_id, source, source_id), so the Strava write will succeed as a separate row — but this is intentional. Strava is the source of truth for route/segment data, while Garmin is the source of truth for HR. If users find this duplicative, they can disable one of the two sync recipes.

6. End with a one-line summary.

If Strava returns no activities, exit silently.`
}
```

---

## Authoring tips

- Test prompts against a real Claude conversation before adding to `recipe-data.ts`. The prompt is the deliverable; the array entry is just packaging.
- Cron expressions in UTC. Document the user's local-time intent in the description so they can adjust if their timezone differs.
- Keep recipes additive. If two recipes overlap (e.g. evening reflection and weekly review both ask about today's workout), the user will skip one. Better to have non-overlapping recipes than redundant ones.
- For connector recipes: name the external MCP and its capabilities in the prompt by their public names. Don't assume a specific tool name — say "fetch yesterday's activities from the Strava connector" rather than `strava.list_activities()`. The prompt should survive the connector renaming a tool.
