# Scheduled-Agent Recipes

Recipes are prompts plus a schedule. They're rendered on `/agents` as cards; users click *Install* and copy the prompt into their Cowork *New Scheduled Task* dialog. The BI app never executes these directly — Cowork does, against whatever Claude instance is configured there, using the BI MCP tools the user authorized.

User-authored recipe docs under `recipes/` in the virtual filesystem (e.g. `sleep-guardian`, `sunday-architect`) are **not** part of this catalog. They stay in the FS and still show under **Your agents**.

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

The `lib/agents/recipe-data.ts` file exports `recipes: Recipe[]`. Display order is array order — group by category in the source. Full prompts live there; this document is the catalog index.

`required_connectors` powers the "Requires: Garmin" badges on the `/agents` cards. BI-only recipes leave the array empty. Connector recipes list every external MCP they call.

`covers` is a deterministic tag set. When an installed user recipe's front-matter `covers:` fully intersects a catalog recipe's tags, the catalog card badges "covered by your \<recipe\>" instead of "not installed". No server reasoning.

## Quality bar for prompts

- **Self-contained.** A prompt should work for someone who has never read the BI codebase. Don't reference internal types or function signatures. Reference MCP tool names by their public names (`log_daily`, `fs_read`).
- **Graceful degradation.** "If `GOALS.md` doesn't exist, ask the user what they're training for" — never assume state.
- **Tight.** Under 500 words per prompt. Long prompts are hard to maintain and bloat token costs at runtime.
- **Reference memory files explicitly.** A recipe that wants to plan a workout should `fs_read("PRINCIPLES.md")` and `fs_read("CURRENT.md")` rather than improvising.
- **Output should land somewhere durable.** A weekly scan that doesn't write `insights/YYYY-Www.md` is a wasted run.

## Catalog (solo-user trim)

Seven recipes. Morning check-in, evening reflection, weekly review, race countdown, and Strava sync were removed from the catalog because the dawn agent already covers their ingest / check-in / evening / race-countdown tags. **Coverage gap:** weekly-review's `review:weekly` tag is *not* on the dawn agent; keep a user-authored weekly recipe (e.g. `sunday-architect`) if you still want that pass.

---

### Dawn agent (`dawn-agent`, autopilot, daily 09:00, requires Garmin)

The flagship daily pass: sync yesterday from the wearable → compute baselines + readiness gate (`log_derived_daily`) → update health threads (`add_health_event_update`) → write `briefings/YYYY-MM-DD.md`. Covers: `ingest:garmin`, `ingest:strava`, `checkin:morning`, `review:evening`, `race:countdown`, `briefing:daily`, `derived:daily`.

Reads PROFILE / GOALS / PRINCIPLES rather than hardcoding thresholds. Captures sleep/HRV/RHR/weight/movement plus recovery vendor *scalars* (`stress_score`, Body Battery, `training_readiness_score`, `training_status`) into columns; factor breakdowns stay in `daily/DATE.md`. Strava is a fallback for phone-only activities the wearable never saw.

### Onboarding (`onboarding`, planning, user-triggered)

Walks first-time users through filling PROFILE.md, GOALS.md, and PRINCIPLES.md. Points them at the dawn agent next. Race blocks in GOALS.md are parsed by the dawn agent and the dashboard, not by a separate countdown recipe.

### Garmin sync (`garmin-sync`, connector, daily 07:00, requires Garmin)

Sync-only ingest of Garmin sleep, vitals, and movement into structured tables; vendor scores go into `daily/YYYY-MM-DD.md`. Subsumed by the dawn agent (which also writes the derived layer and briefing). Covers: `ingest:garmin`.

### Capacity sync (`capacity-sync`, connector, weekly Mon 08:00, requires Garmin)

Pulls slow-moving fitness capacity (VO2max, lactate threshold, FTP, endurance/hill score, fitness age, running tolerance, race predictions) from the wearable into `capacity_metrics` via `log_capacity`. Then derives training zones into `THRESHOLDS.md` (Claude computes the zones from LTHR/FTP — BI stores nothing derived) and updates `RECORDS.md` PR blocks from `get_personal_record`. Covers: `capacity:sync`, `thresholds:zones`, `records:prs`.

### Backfill (`backfill`, connector, one-shot, requires Garmin)

One-time rehydration: iterate the last 90 days of Garmin workouts and `update_workout` the structured `metrics`/`zones` (HR zones, vendor load, decoupling, weather) + seed capacity, so training load switches from the RPE fallback to zone-TRIMP and the empty Analyze bands light up retroactively. Covers: `backfill:garmin`.

### Health-log audit (`health-log-audit`, review, every other Monday 17:00)

Reviews active health events and asks if any should be marked resolved. Updates HEALTH_LOG.md narrative blocks. Covers: `health:audit`.

### Insights scan (`insights`, review, weekly Sun 19:00)

The intelligence layer. Reads the deterministic statistics engine (`get_correlation_matrix`, `get_trend`, `get_load_balance`, `get_distribution`, `get_correlation`) and writes a plain-language interpretation to `insights/YYYY-Www.md`: the biggest signal of the week, the relationships worth acting on (with r and n, and the correlation-isn't-causation caveat), the load/form read against `PRINCIPLES.md`, one thing to optimize next, and what the data can't yet say. This is the "what to optimize" reasoning the app deliberately never does itself — it lives in the recipe (Claude), and the dashboard's Insights band renders the prose. Covers: `insights:weekly`.

---

## Authoring tips

- Test prompts against a real Claude conversation before adding to `recipe-data.ts`. The prompt is the deliverable; the array entry is just packaging.
- Cron expressions in UTC. Document the user's local-time intent in the description so they can adjust if their timezone differs.
- Keep recipes additive. Overlapping catalog cards are now handled by `covers` tags rather than duplicate prompts.
- For connector recipes: name the external MCP and its capabilities in the prompt by their public names. Don't assume a specific tool name — say "fetch yesterday's activities from the Garmin connector" rather than `garmin.list_activities()`. The prompt should survive the connector renaming a tool.
- Do not mention meal tools or dropped `daily_entries` columns (subjective 1–5 scales, unused body-comp/vitals, `meal_notes`). Qualitative flags go in `wellness_notes`.
