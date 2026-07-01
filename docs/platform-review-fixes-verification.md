# Platform Review — Fixes & Verification

**Date:** 2026-07-01 · **Scope:** implement every finding from `docs/platform-review-2026-06-30.md`, commit + push each, and verify on production (`bi.vardenlab.com`) via the Chrome MCP.

Each fix is its own commit on `main` (auto-deployed to production). App-side fixes were verified live in the browser; recipe/doc fixes are catalog changes the user adopts into their own Cowork agent, so they're verified structurally (the catalog/UI renders them) with a note where live data can't yet exercise them.

## Status summary

| # | Fix | Commit | Verified |
|---|-----|--------|----------|
| 1 | Load model: exclude non-endurance + normalize scale | `6acc19b` | ✅ live |
| 10 | No fabricated 100% sleep efficiency (null-guard) | `a7d264f` | ✅ live |
| 11 | Drilldown axis clamp to populated span | `c3c66ee` | ✅ live |
| 12 | Drilldown "you are here" percentile marker | `c3c66ee` | ✅ live |
| 8 | Recovery baselines: fixed 60d window + leave-one-out z | `9ccc97d` | ✅ live |
| 9 | Lag-scan Fisher CI + anchor-on-lag-0 guard | `9ccc97d` | ✅ live |
| 13 | Recharts flash-blank: per-chart initialDimension | `44f364e` | ✅ live (reduced) |
| 15 | Honest empty-state copy | `747c3cd` | ✅ live |
| 7 | Overdue milestone rendering | `15abbcb` | ✅ code (needs recipe to set milestone) |
| 4 | /agents capture-gap banner + staleness | `ddccd1f` | ✅ live |
| 3 | TodayHero briefing lead | `c07f952` | ✅ deployed (gate present today) |
| 14 | Race-readiness (goal convergence) | `c07f952` | ✅ deployed (no parseable race → graceful) |
| 2/3a/5/6 | Recipes: derived-first, milestones, backfill | `6c82e5c` | ✅ catalog ("All 12") |

Local gates on every commit: `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` (64 tests), and `pnpm build` all green.

---

## Live evidence (Chrome MCP on `bi.vardenlab.com`)

### #1 — Load model (the marquee fix) ✅
The Analyze headline went from the implausible **CTL 503 / TSB −264 / ACWR 1.48** to a physiologically sane **CTL 120 / TSB −60 / ACWR 1.32**. The load-band footer now reads:

> `Load source: 0 zone-TRIMP · 1 vendor · 62 RPE-estimated · 31 non-endurance excluded (golf/walk/…)`

So golf/walk are excluded from load (31 workouts), and the RPE fallback is halved — exactly the fix. (Training *hours* still show golf; only *load* excludes it.)

### #8 — Recovery baselines decoupled ✅
Subtitle now: "*Each signal against its own ±1 SD normal range **over a fixed 60-day window**, with today's **leave-one-out z-score**.*" HRV reads **today +0.4 SD** (the honest LOO value; it was an in-sample +2.7 before), over a fixed 05-02 → 07-01 axis independent of the 7d/30d/90d toggle.

### #9 — Lag-scan CIs + anchor guard ✅
Relationships now show **same-day** (not "best lag") with a Fisher CI and a null flag, e.g.:

> `Sleep → HRV: r −0.00 [−0.27, +0.26] · R² 0.00 · n 55 · same-day · CI spans 0 (not clear)`
> `Resting HR → sleep quality: r +0.03 [−0.45, +0.49] · n 18 · same-day · CI spans 0 (not clear)`

The misleading "best lag 1d, r −0.16" is gone.

### #11 / #12 — Drilldown ✅
`/data/metric/rhr_bpm` header now reads the real span "**2026-05-07 → 2026-07-01 · 56 observations**" (not "Last 365 days"), the History line fills the plot, and the Distribution shows the blue **"you" marker at 59** with the caption "**Latest 59 — about p46 of your window range.**"

### #4 — /agents drift surfacing ✅
An amber banner is live at the top of `/agents`: "**Your agent is behind the catalog — data isn't being captured** … the last 30 days have no HR zones and no capacity … forces training load onto the crude RPE fallback. Update your dawn-agent recipe … install the capacity-sync + backfill recipes below." The 1-month-old "Daily Sync Routine" now carries an amber **"stale"** badge, and the library shows **"All 12"** recipes (the new **backfill** is in Connector).

### #15 — Honest empty states ✅
Capacity band: "*No capacity snapshots yet — **your dawn agent isn't capturing capacity**. Install the capacity-sync recipe (or run the backfill)…*" Intensity band: "*No HR-zone data yet — **your dawn agent isn't capturing per-activity HR zones**. Update its recipe (or run the backfill)…*"

### #10 — Sleep efficiency ✅
The null-guard is deployed (nights without captured awake-time now show `—` instead of a fabricated 100%). Notably the per-night bars now show real red **Awake** segments, so the agent *is* recording awake time; the latest night has ~0 awake, so its 100% is legitimate rather than fabricated.

### #13 — Chart flash-blank (reduced) ✅
Per-chart `initialDimension` is deployed on all six chart components. Charts paint a correctly-proportioned frame; a brief hydration tick can remain on first navigation (Recharts measures client-side), so this is a mitigation. The documented long-term option is porting these two surfaces to server-SVG.

### #3 — TodayHero ✅ (deployed; gate present today)
The briefing-lead code path is deployed. Today it isn't exercised because the dawn-agent *did* write `derived_daily` for Jul 1, so the hero renders the full **RED · "Today's call: Rest"** verdict with its reason ("Sleep debt 712min … chronic fatigue call"). The lead-inlining fallback fires only on days the structured gate is missing.

### #14 — Race readiness ✅ (deployed; degrades gracefully)
Implemented (`parseGoalSeconds` + `racePredictionKey`, joined to the capacity prediction). No panel renders currently because GOALS.md has no dated race block whose distance + goal parse — the intended graceful no-op. It will show "predicted vs goal · Nd to race" once a parseable A-race and capacity predictions exist.

### #7 — Overdue milestones ✅ (code deployed; awaits recipe data)
The `daysOut >= 0` filter and `Math.max(0,…)` clamp are removed, so an overdue checkpoint renders "overdue Nd" in rose and sorts first. It can't show live yet because the running fork hasn't set `next_milestone` on the injury (the briefing still flags the MRI in prose only — 10th day). The updated dawn-agent recipe (#6) now instructs setting it.

### #2 / #3a / #5 / #6 — Recipes ✅ (catalog)
The catalog now has **12** recipes including the new one-shot **backfill** (Connector). The dawn-agent recipe was updated to write `log_derived_daily` first (#3a) and to set `next_milestone` for awaited results (#6). These are prompt templates the user adopts into their Cowork task — the running fork can't be edited from the app, which is exactly why #4 (drift banner) + #5 (backfill) exist as the delivery path.

---

## Net effect

The two root causes from the review are resolved on the app side and delivered as a closable path on the capture side:

- **Load is now trustworthy** — CTL 503 → 120 by excluding golf and normalizing the RPE fallback; provenance + exclusion are shown.
- **Drift is now visible and fixable** — the `/agents` banner + staleness badge + the backfill recipe give the user a one-click path to switch load from RPE to zone-TRIMP and light up the empty bands.
- **Statistics are honest** — fixed baseline windows, leave-one-out z, and lag CIs stop weak signals from reading as findings.
- **Detail surfaces are correct** — real drilldown spans, percentile markers, guarded sleep efficiency, overdue milestones.

Remaining data-gated items (#7 milestone, #14 goal panel, and the capacity/intensity/zone-TRIMP bands) light up automatically once the user adopts the updated dawn-agent recipe and runs the backfill.
