# Body Intelligence — Platform & Statistics Review

**Date:** 2026-06-30 · **Environment reviewed:** production `bi.vardenlab.com` (live, authenticated, real Garmin data) · **Method:** hands-on Chrome walkthrough of every surface (Analyze with all bands, per-metric drilldown, Timeline, Calendar, /agents, the dawn-agent briefing) cross-referenced with a four-lens code analysis (statistics, data-capture, UX/rendering, sports-value).

All recommendations below stay inside the **passive constraint**: deterministic statistics + taxonomy filters in the app, Claude-authored verdicts parked in `derived_daily`/`insights`. None introduce server-side scoring or an LLM.

---

## Executive summary

The **reasoning layer is genuinely coach-grade** — the dawn-agent's briefing reads like a real coach (sleep-debt-bound gate analysis, HRV/RHR illness-marker reasoning, capacity narrative, an 8th-consecutive nudge that the MRI result is unlogged). The **redesigned UI also works**: the Analyze headline strip, CTL/ATL/TSB chart with context bands, ACWR, recovery baselines, the lower-triangle correlation heatmap with confidence fading, the lag-scanned relationships, and the per-metric drilldown all render with real data, and the registry fix that was 404-ing capacity/zone drilldowns is confirmed live.

But the **quantitative surfaces are undermined by two compounding root causes**:

1. **The training-load model is physiologically meaningless.** The headline reads **Fitness (CTL) 503 / Form (TSB) −264 / Strain 5721** — roughly 4–5× what any TrainingPeaks-literate endurance athlete expects (CTL ~50–150). Two bugs compound: golf (the *largest* logged chunk, 66 h/90 d) is counted as training stimulus, and the "training-only" toggle that should fix it never reaches the load tool.

2. **The user's forked custom dawn-agent has drifted behind the catalog** and never writes the structured columns — so the load is **94/94 "RPE-estimated"** (footer-confirmed), the Fitness & capacity and Intensity-distribution bands are permanently empty, the readiness gate is dark, sleep efficiency is a fabricated 100%, and the health-thread timeline is blank.

**The single biggest lever** is making the load numbers trustworthy (app-side, deployable now) *and* refreshing the capture recipe (which fixes the load scale at its source by replacing RPE with zone-TRIMP and lights up the empty bands at the same time).

---

## What's working well (don't regress these)

- **Dawn-agent briefings** — coach-grade reasoning; the strongest part of the platform.
- **Recovery baselines** — HRV "today +2.7 SD, normal range 28–42 ms", RHR "today −2.0 SD"; clean and honest.
- **Correlation heatmap** — lower-triangle, per-cell `n`, low-n cells faded, "28 pairs / expect some by chance" caveat. RHR×HRV = −0.72 is a real signal surfaced correctly.
- **The `get_trend` materiality gate** — HRV drilldown correctly reads "flat: +0.38 ms/30d, R² 0.00" instead of a false "rising".
- **Metric drilldowns** — registry fix confirmed; no more 404s on capacity/zone keys.
- **Empty/low-n states** — present everywhere (just need honest copy — see #15).

---

## Cross-cutting themes

1. **The marquee load model is un-trustworthy** — mixed-scale EWMA + golf-as-training + a dead toggle ⇒ CTL 503 / TSB −264 torpedoes trust in the whole headline.
2. **A drifted custom agent starves nearly every statistic** — it writes prose, not structured columns (zones, vendor load, capacity, `derived_daily`, `health_event_updates`, `sleep_awake_min`).
3. **There's no path to detect or close the recipe drift** — `/agents` badges the fork "covered" with no recency or capability diff, and no backfill recipe exists to rehydrate the 90 days of data already sitting in Garmin.
4. **Statistical-rigor gaps make weak signals look authoritative** — in-sample z-scores that change with the display toggle, and a lag-scan that promotes the strongest-of-4 lags with no confidence interval.
5. **Detail-surface correctness** — fabricated 100% sleep efficiency, a 365-day axis cramming 54 days into the right 15%, a missing drilldown percentile marker, Recharts flash-blank, and the overdue MRI milestone silently dropped.

---

## Prioritized improvements

| # | Improvement | Category | Impact | Effort | Passive-safe |
|---|---|---|---|---|---|
| 1 | Fix the load model: exclude golf, thread the toggle into `getLoadBalance`, normalize load scales | statistics | High | M | ✅ |
| 2 | Refresh the custom dawn-agent to write structured columns (zones, vendor load, capacity, awake-min, decoupling, weather) | data-capture | High | M | ✅ |
| 3 | Make the agent write `log_derived_daily` first so the readiness gate renders today | data-capture | High | S | ✅ |
| 4 | Add a catalog-vs-fork capability diff on `/agents` so drift is visible & closable | data-capture | High | M | ✅ |
| 5 | One-shot backfill recipe to rehydrate 90 d of zones/vendor/decoupling/capacity | data-capture | High | M | ✅ |
| 6 | Light up the health-thread timeline via `add_health_event_update` per day | data-capture | Med | S | ✅ |
| 7 | Escalate overdue injury milestones (the 8-day-late MRI) instead of dropping them | sports-value | Med | S | ✅ |
| 8 | Decouple recovery baselines/z-scores from the display toggle; compute z leave-one-out | statistics | Med | M | ✅ |
| 9 | Add confidence intervals + a multiple-comparison guard to the lag-scan "best lag" | statistics | Med | M | ✅ |
| 10 | Stop rendering a fabricated 100% sleep efficiency when awake-minutes are missing | correctness | Med | S | ✅ |
| 11 | Clamp the drilldown axis to the populated span instead of a fixed 365 days | ux-rendering | Med | S | ✅ |
| 12 | Add the "you are here" percentile marker to the drilldown distribution | ux-rendering | Low | S | ✅ |
| 13 | Kill the Recharts flash-blank via per-chart `initialDimension` | ux-rendering | Low | M | ✅ |
| 14 | Goal-convergence panel: predicted marathon time vs the sub-3 target | sports-value | High* | M | ✅ |
| 15 | Make the empty capacity/intensity/relationship band CTAs honest & actionable | ux-rendering | Med | S | ✅ |

\* #14 is high-value but gated on capacity capture (#2/#5) landing first.

---

## Details

### Theme A — The training-load model (the most visible problem)

**1. Fix the load model — exclude golf, thread the toggle, normalize the scales.** *(High · M)*
The headline reads CTL 503 / TSB −264 / ACWR 1.48 / Strain 5721, ~4–5× endurance norms, with the PMC footer showing `0 zone-TRIMP · 0 vendor · 94 RPE-estimated`. Two bugs compound:
- **Golf is counted as training** at the `duration×(rpe??5)` fallback — a 4 h round ≈ 240×5 = 1200 impulse, dwarfing a real run. Golf is the largest logged chunk (66 h/90 d vs 20 h run).
- **The "training-only" toggle is dead for stats.** `?nogolf=1` only shapes `filteredWorkouts` in `app/(app)/data/page.tsx`; `analyze.tsx` calls `getLoadBalance(userId, {days})`, which re-queries **all** workouts via `dailyImpulseSeries` (`lib/data-display/metric-series.ts`, no type filter). The one control that should fix this does nothing.
- **The three load branches are never normalized.** `workoutLoad()` emits Edwards TRIMP, vendor Garmin load, and `duration×rpe` into one EWMA without a common unit — so even once zones arrive the impulse series will step-discontinuously mid-window.

**Fix:** add an `excludeTypes`/`trainingOnly` arg to `get-load-balance.ts` and thread the existing toggle through `dailyImpulseSeries`; default to excluding a fixed non-endurance type set (golf, walk, mobility, yoga — already in `CANONICAL_WORKOUT_TYPES`) and surface golf's on-feet minutes as a separate descriptive line. Normalize every `workoutLoad()` branch to a TRIMP-equivalent unit (keep zone-TRIMP; map `duration×rpe → duration×(rpe/2)`; apply a fixed vendor constant) documented in a constants block. On the headline, **lead with scale-free measures** (ACWR, CTL ramp %, TSB as % of CTL) and label raw CTL/TSB "arbitrary load units." *(Excluding by a constant type list is a deterministic taxonomy choice, like `normalizeWorkoutType` — not a verdict.)*

### Theme B — The capture loop (the upstream root cause)

**2. Refresh the custom dawn-agent to write structured columns.** *(High · M)*
The user runs a forked `recipes/dawn-agent.md` (33 runs, badged "Yours") that predates the catalog upgrade. It routes vendor load, running dynamics, HR drift, and vendor scores into `daily/*.md` prose and never calls `get_activity_hr_zones` — so load is 94/94 RPE-estimated, the capacity & intensity bands are empty, sleep efficiency is fake-100% (no `sleep_awake_min`), and the Heat→decoupling / Acute-load→soreness cards are structurally empty. **The MCP tools already accept all of this** (`log_workout` takes nested `metrics{…}` and `zones{hr_z1_s…}`); the side tables are simply never written.
**Fix (recipe-prompt edit, passive-safe):** on each `log_workout`, pass `metrics{vendor_training_load, cadence_spm, gct_ms, gct_balance_pct_left, decoupling_pct, weather_temp_c, weather_humidity_pct}` and `zones{hr_z1_s…hr_z5_s}` from `get_activity_hr_zones`/`get_activity_weather`; capture `sleep_awake_min`; add a weekly capacity pass (`get_vo2_max`/`get_cycling_ftp`/`get_race_predictions` → `capacity_metrics`). This converts all-RPE load to zone-TRIMP — fixing the scale at its source — and lights up both empty bands. The app can't edit the user's doc, so deliver via #4 (drift surfacing) + #5 (backfill).

**3. Make the agent write `log_derived_daily` first so the gate renders today.** *(High · S)*
`derived_daily` was written for Jun 29 but not Jun 30, so `TodayHero` degrades to "structured gate not written yet" even though the briefing carries a crisp AMBER / Z1-rest call. **Fix:** (a) make `log_derived_daily(DATE_T, …)` the **first** write in the agent's Phase 2 (idempotent full-row replace) so even a partial run leaves today's gate; (b) pass the latest briefing's **content** into `TodayHero` and inline its lead in the stale/briefing-only states (rendering Claude's markdown is passive display). **Do not** have the app parse a gate out of the briefing — that would author a verdict server-side.

**4. Add a deterministic catalog-vs-fork capability diff on `/agents`.** *(High · M)*
`/agents` badges the fork "covered by your recipe" with no recency check and no capability diff, so the catalog upgrade can never reach the running fork (`coveredBy()` can't even fire — the user's docs have no YAML front-matter, so `covers:[]`). **Fix (pure string/tag arithmetic):** (a) add an `updated_at`/version + a "what changed" changelog to each catalog `Recipe`; badge "Catalog updated since your copy." (b) Test whether known capture tokens (`get_activity_hr_zones`, `hr_z1_s`, `log_capacity`, `log_derived_daily`, `add_health_event_update`, `weather`, `sleep_awake_min`) appear in the user's recipe text; render the misses as "Your version may not capture: HR zones, capacity, weather, structured gate." (c) Row-count banner: zero `workout_zones`/`capacity_metrics` rows in N days despite an active agent → "your agent isn't capturing HR zones — update its prompt."

**5. Ship a one-shot backfill recipe.** *(High · M)*
90 days of HR-zone/vendor/decoupling/capacity data already exist in Garmin (`workouts` carry `source='garmin'` + `source_id`); they were never pulled into columns. **Fix (recipe):** `list_workouts(days=90)` → per Garmin run, `get_activity_hr_zones(source_id)` + `get_activity` → `update_workout(id, {metrics, zones})` (already a full-replace upsert, so idempotent), plus a capacity seed from `get_vo2_max`/`get_race_predictions` history. Surface it from `/agents` as a suggested first step.

**6. Light up the health-thread timeline.** *(Med · S)* The redesigned `HealthThreads` card renders `thread.updates` + a severity sparkline, but live events have `update_count=0` and a giant `STATUS …`-blob `notes` field, so the card collapses to a 2-line clamp — the most important card for an injured athlete is empty. **Fix (recipe):** call `add_health_event_update(event_id, DATE, note, severity_at_time)` per day; keep `notes` as the stable summary.

### Theme C — Statistical rigor

**8. Decouple baselines/z-scores from the display toggle; compute z leave-one-out.** *(Med · M)* Baselines are computed in-sample over whatever window is selected, so the *same day's* z and "normal range" silently change across 7d/30d/90d/1y (the hero at 30d and Analyze at 90d disagree), a 7d toggle can baseline off 3 points, and the latest value is included in its own mean/sd. **Fix:** compute recovery baselines over a **fixed** trailing window (42–60 d) regardless of display range, and compute today's z **leave-one-out**.

**9. Add CIs + a multiple-comparison guard to the lag-scan.** *(Med · M)* "Sleep→HRV r −0.16, n53, best lag 1d" is statistically indistinguishable from zero yet presented as a finding, and picking max-|r| across lags 0–3 biases the coefficient upward. **Fix:** Fisher-z 95% CI `tanh(atanh(r) ± 1.96/√(n−3))`, display `r −0.16 [−0.42, +0.12]` so a CI spanning 0 reads as null; show lag-0 as the anchor and label best-lag "strongest of lags 0–3 (exploratory)", only promoting it when its CI excludes 0; raise `minN` to ~12–14.

### Theme D — Rendering & correctness

**10. Stop the fabricated 100% sleep efficiency.** *(Med · S)* `efficiency = asleep/(asleep+0) = 100%` whenever `sleep_awake_min` is null (coerced to 0). **Fix:** track `hasAwake` per night, render `—` when awake wasn't captured; prefer a vendor sleep score when present. Pairs with #2.

**11. Clamp the drilldown axis to the populated span.** *(Med · S)* The History chart hard-codes 365 days over ~54 days of data, cramming the line into the right ~15%. **Fix:** trim to `[firstNonNullDate, lastNonNullDate]` and change the header from a literal "Last 365 days" to the actual span.

**12. Add the "you are here" marker to the drilldown distribution.** *(Low · S)* `HistogramChart` already supports it and Analyze uses it; the drilldown just omits the `latest` prop. One-line fix.

**13. Kill the Recharts flash-blank.** *(Low · M)* `components/ui/chart.tsx` seeds one `INITIAL_DIMENSION {320,200}` for all charts, but containers use `aspect-[16/7]`/`[4/3]`/`[16/6]`, so Recharts paints a mismatched frame then snaps. **Fix (short-term):** per-chart `initialDimension` matching each aspect. **(Long-term, on-architecture):** port the Analyze/drilldown line+histogram to the hand-rolled server-SVG primitives (`sparkline`/`bar-stack`) — no Recharts, no hydration gap.

### Theme E — Sports value (next features)

**7. Escalate overdue injury milestones.** *(Med · S)* The MRI has been flagged unlogged for 8 days, but the dashboard shows no escalation — `page.tsx` filters milestones to `daysOut >= 0` and `TodayHero` clamps `Math.max(0, …)`, so an overdue checkpoint can never render. **Fix:** (recipe) set `next_milestone='MRI result'` + date via `update_health_event`; (app) drop the `>=0` filter and the clamp, rank overdue first, render "`MRI result · overdue 8d`" in a warn tone in both `TodayHero` and the `HealthThreads` pill.

**14. Goal-convergence panel — predicted marathon time vs the sub-3 target.** *(High · M, gated on #2/#5)* `capacity_race_pred_marathon_s`, `derived_daily.days_to_race`, and `GOALS.md` parsing already exist, but nothing joins the prediction to the 3:00:00 target. **Fix:** plot the marathon (and half) prediction over the window with a horizontal reference line at the parsed goal (10800 s) + a days-to-race marker + the OLS trend. The "on track / behind" sentence stays in the insights recipe prose. This is the payoff view that makes capacity capture worth doing.

**15. Make empty-state CTAs honest.** *(Med · S)* The Intensity band says "the dawn agent captures it per activity from Garmin" — but the *running* agent doesn't, so the copy promises something it won't do. **Fix:** until #2/#5 land, point empty states at the updated recipe / backfill and note the running agent doesn't yet capture these inputs; replace the dead "Need ≥10 paired days" scatters with an explicit "capture needed: weather/decoupling" placeholder.

---

## Quick wins (S-effort, high signal)

- Pass `latest={latestNonNull(series.series[metric])}` to the drilldown `HistogramChart` → restores the percentile marker. *(#12)*
- Clamp the drilldown History axis to `[firstNonNullDate, lastNonNullDate]`. *(#11)*
- Guard sleep efficiency with `hasAwake`; render `—` instead of a fake 100%. *(#10)*
- Drop the `daysOut >= 0` filter + `Math.max(0,…)` clamp so the overdue MRI renders "overdue 8d" in rose. *(#7)*
- Recipe: move `log_derived_daily` to the first Phase-2 write so a partial run still leaves today's gate. *(#3)*
- Recipe: call `add_health_event_update` per day instead of appending `STATUS` blocks. *(#6)*
- Per-chart `initialDimension` matching each Recharts aspect → kills the 1–2 s flash. *(#13)*
- `/agents` staleness badge from the existing `last_run_at` ("expected daily, last ran Xh ago"). *(#4)*

---

## Recommended sequencing

1. **App-side now (deployable today):** #1 (load model + golf + toggle), #10/#11/#12 (rendering correctness), #7 (overdue milestones). These restore trust in the numbers you already show.
2. **Close the capture loop:** #2 (refresh the dawn-agent recipe) + #5 (backfill) + #3 (gate-first) + #6 (health updates). This replaces RPE with zone-TRIMP — fixing the load *scale at its source* — and lights up the empty capacity/intensity/relationship bands and the health timeline.
3. **Make drift self-healing:** #4 (catalog-vs-fork diff + staleness on `/agents`) so this never silently recurs.
4. **Then the payoff features:** #14 (goal convergence), #8/#9 (statistical rigor), #13 long-term SVG port.

**The one-sentence takeaway:** the platform's reasoning is excellent and the new UI is solid — the gap is that your *running* agent stopped feeding the structured tables, and golf is polluting the load math; fix those two and almost every empty band and implausible number resolves at once.

---

## Appendix — surfaces inspected (live)

Analyze view (headline strip, Notable days, Daily-metric cards + Δ arrows, Sleep architecture, CTL/ATL/TSB + monotony/strain + load-source footer, ACWR ratio, Fitness & capacity [empty], Intensity distribution [empty], Sleep vs HRV overlay, Recovery baselines, Correlation heatmap, Distributions, lag-scanned Relationships) · per-metric drilldown (`/data/metric/hrv_ms`) · Timeline (30 d) · Calendar (90 d) · `/agents` (11 recipes; the user's forked dawn-agent) · the dawn-agent briefing document.
