# Scheduled-Agent Recipes

Recipes are prompts plus a schedule. They're rendered on `/agents` as cards; users click *Install* and copy the prompt into their Cowork *New Scheduled Task* dialog. The BI app never executes these directly — Cowork does, against whatever Claude instance is configured there, using the BI MCP tools the user authorized.

**Canonical prompts live in `lib/agents/recipe-data.ts`.** This document is the catalog spec: ids, schedules, covers tags, and what each recipe is for. If the two disagree, the TypeScript file wins.

## The Recipe type

```ts
type Recipe = {
  id: string;                       // kebab-case, stable
  title: string;                    // 4-6 words
  category: "autopilot" | "capture" | "review" | "connector" | "planning";
  schedule: string;                 // cron expression, UTC unless documented otherwise
  description: string;              // one sentence on the card
  prompt: string;                   // the full prompt that runs each time
  required_tools: string[];         // BI MCP tool names this recipe calls
  required_connectors: string[];    // external Claude connectors needed (e.g. ["garmin"])
  covers: string[];                 // capability tags for /agents "covered by" badges
};
```

The `lib/agents/recipe-data.ts` file exports `recipes: Recipe[]`. Display order is array order.

`required_connectors` powers the "Requires: Garmin" badges on the `/agents` cards. `covers` is a deterministic tag set: a catalog card whose tags are fully covered by an installed user-authored recipe (parsed from `recipes/*.md` YAML front-matter) shows "covered by your \<recipe\>" instead of "not installed".

User-authored recipe docs under `recipes/` in the virtual filesystem (e.g. sleep-guardian, sunday-architect) are **not** in this catalog. Do not delete them.

## Quality bar for prompts

- **Self-contained.** A prompt should work for someone who has never read the BI codebase. Reference MCP tool names by their public names (`log_daily`, `fs_read`).
- **Graceful degradation.** Never assume memory files are filled in.
- **Tight.** Under 500 words per prompt.
- **Reference memory files explicitly.** `fs_read("PRINCIPLES.md")` rather than improvising.
- **Output should land somewhere durable.** A run that doesn't write a table row or a document is a wasted run.
- **No meal tools / dropped daily columns.** `log_meal` is gone. Subjective 1–5 scales (`fatigue`, `soreness`, `mood`, `stress`, `motivation`, `sleep_quality`), empty body-comp/vitals, and `meal_notes` are gone. Vendor `stress_score` is kept.

## Catalog (solo-user trim)

Seven recipes. Morning check-in, evening reflection, race countdown, and Strava sync are redundant with dawn-agent `covers` (`checkin:morning`, `review:evening`, `race:countdown`, `ingest:strava`) and were removed. Weekly review (`review:weekly`) is **not** a subset of dawn or insights (`insights:weekly`); it was still removed as agreed — insights is the remaining weekly reasoning pass.

The `/agents` filter chips hide empty categories, so the unused `capture` category does not render.

---

### Dawn agent (`dawn-agent`)

- **Category:** `autopilot` · **Schedule:** `0 9 * * *` · **Requires:** Garmin
- **Covers:** `ingest:garmin`, `ingest:strava`, `checkin:morning`, `review:evening`, `race:countdown`, `briefing:daily`, `derived:daily`
- **Does:** One idempotent daily pass. Sync yesterday's wearable vitals/workouts into `log_daily` / `log_workout` (with `metrics` + `zones`), write vendor breakdowns to `daily/YYYY-MM-DD.md`, compute baselines + readiness gate via `log_derived_daily`, update health threads, write `briefings/YYYY-MM-DD.md`.
- **Does not log:** body-comp beyond `weight_kg`, blood pressure, hydration, subjective 1–5 scales, or meals.

### Onboarding (`onboarding`)

- **Category:** `planning` · **Schedule:** `0 0 1 1 *` (placeholder; user-triggered)
- **Covers:** `onboarding`
- **Does:** Walks the user through PROFILE / GOALS / PRINCIPLES. Race blocks in GOALS.md are parsed by the **dawn agent** for `days_to_race`. Ends by offering the dawn agent, not a morning check-in.

### Garmin sync (`garmin-sync`)

- **Category:** `connector` · **Schedule:** `0 7 * * *` · **Requires:** Garmin
- **Covers:** `ingest:garmin`
- **Does:** Sync-only ingest of yesterday's Garmin sleep, vitals, movement, Body Battery / readiness prose, and activities. Subsumed by the dawn agent for users who want the full pass (derived layer + briefing). Editorialising on the numbers is the dawn agent's job.

### Capacity sync (`capacity-sync`)

- **Category:** `connector` · **Schedule:** `0 8 * * 1` (weekly Monday) · **Requires:** Garmin
- **Covers:** `capacity:sync`, `thresholds:zones`, `records:prs`
- **Does:** Weekly snapshot of VO2max / LT / FTP / endurance / race predictions into `capacity_metrics`; refreshes `THRESHOLDS.md` zones and `RECORDS.md` PRs.

### Backfill (`backfill`)

- **Category:** `connector` · **Schedule:** `0 0 1 1 *` (one-shot) · **Requires:** Garmin
- **Covers:** `backfill:garmin`
- **Does:** One-time rehydrate of the last 90 days of Garmin workouts (`update_workout` metrics/zones) plus a capacity seed, so load switches from RPE fallback to zone-TRIMP.

### Health-log audit (`health-log-audit`)

- **Category:** `review` · **Schedule:** `0 17 * * 1/14`
- **Covers:** `health:audit`
- **Does:** Reviews unresolved health events, asks which to resolve, writes `HEALTH_LOG.md` narrative blocks.

### Insights scan (`insights`)

- **Category:** `review` · **Schedule:** `0 19 * * 0` (Sunday)
- **Covers:** `insights:weekly`
- **Does:** Reads the deterministic stats engine (correlations, trends, CTL/ATL/TSB, distributions) and writes a plain-language interpretation to `insights/YYYY-Www.md` — the "what to optimize" reasoning the app never does itself. Correlation matrix uses `stress_score` (vendor scalar), not dropped subjective scales.

---

## Removed from the catalog (do not resurrect without a new decision)

| id | Why it went |
|---|---|
| `morning-checkin` | Dawn `covers: checkin:morning` |
| `evening-reflection` | Dawn `covers: review:evening` |
| `race-countdown` | Dawn `covers: race:countdown` (parses GOALS.md) |
| `strava-sync` | Dawn `covers: ingest:strava` (Strava-only activities the wearable never saw) |
| `weekly-review` | Agreed cut. Not a subset of dawn. Insights (`insights:weekly`) is the remaining weekly reasoning pass; it does not rewrite `CURRENT.md` the way weekly-review did. |
