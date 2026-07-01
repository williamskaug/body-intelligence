# Platform Review — Data & Presentation

**Date:** 2026-07-01 · **Scope:** a focused pass over *the data itself* and *how the
data is presented* on `bi.vardenlab.com/data`, done live in the browser. This is a
follow-up to `docs/platform-review-2026-06-30.md` (which fixed the load model and
statistical honesty) and `docs/platform-review-fixes-verification.md`. Where the
earlier review fixed *what the statistics compute*, this one fixes *what the surface
shows when the data is thin* — the places where a sparse or lopsided dataset was
rendering as a confident-looking chart.

## The two problems, restated

1. **Thin data was rendering as findings.** A metric with two logged days drew a
   2-point sparkline that reads as a trend. The correlation matrix reserved rows and
   columns for metrics with almost no history, so most cells were empty and read as
   "no relationship" rather than "no data". These are presentation bugs — the
   statistics were honest, the *chart* wasn't.

2. **The signal that matters was buried, and one headline double-counted.** The
   RED-driving sleep-debt number lived inside a "Why" fold, so a red verdict wasn't
   glanceable. The Insights essay pushed the deterministic stat bands below the fold.
   And "Training hours" counted golf (which is *excluded* from training load), so the
   hours headline and the load model disagreed with each other.

None of these touch the passive line: every fix is display-side. The app still
computes only deterministic statistics and still renders the agent's authored gate
verbatim — it just stops drawing charts over data that can't support them, and
re-orders what's shown first.

## The five fixes

| # | Fix | File | Commit |
|---|-----|------|--------|
| P1 | Prune low-coverage metrics from the correlation matrix | `components/data/analyze.tsx` | `de223b2` |
| P2 | Insufficient-data states for sparse sparklines | `components/data/trends.tsx` | `790ce20` |
| P3 | Collapse the Insights essay to a scannable lead | `components/data/insights-feed.tsx` | `7a7572f` |
| P4 | Surface sleep debt as a glanceable hero chip | `components/data/today-hero.tsx` | `a94c981` |
| P5 | Split non-endurance hours out of "Training hours" | `app/(app)/data/page.tsx`, `lib/data-display/aggregate.ts` | `db39c1c` |

Local gates green on every commit: `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test`
(67 tests, +3 new for the `hoursByType` split), `pnpm build`.

---

### P1 — Correlation matrix prunes empty rows/cols

**Problem.** The heatmap's metric set includes `weight_kg`, `body_fat_pct`, and
`soreness` — all barely logged in this dataset. Each got a full row and column of
near-empty cells, so the matrix looked broken: a grid of blanks that reads as "these
things aren't related" when the truth is "we have no overlapping days".

**Fix.** A `pruneMatrix(metrics, mat, n, minCoverage)` helper drops any metric whose
diagonal coverage `n[i][i]` is below ~12 logged days *before* the heatmap renders.
If fewer than 3 metrics survive, the band shows an honest empty state ("Not enough
overlapping history yet — needs ≥3 metrics with ~12+ logged days") instead of a
sparse grid. When some are dropped, a "N metrics hidden for insufficient data" note
makes the pruning explicit rather than silent.

### P2 — Sparse sparklines show an insufficient-data state

**Problem.** The sleep-debt card and each readiness-factor z-row drew a `Sparkline`
unconditionally. With one or two non-null points, that's a flat 2-point line — which
reads as "stable trend at this level" when it's really "one data point".

**Fix.** A `MIN_TREND = 5` non-null-point threshold gates every trend micro-chart.
Below it, the card renders `N day(s) logged · need ≥5 for a trend` (a dashed
placeholder) instead of a misleading line. Applied to both `SleepDebtCard` and each
row of `ReadinessFactorsCard`.

### P3 — Insights essay collapses to a lead

**Problem.** `InsightsFeed` rendered the latest insight's full markdown inline. A
long weekly essay pushed the CTL/ATL/TSB chart, correlation heatmap, and
distributions far below the fold — the deterministic data the essay is *about* was
harder to reach than the prose.

**Fix.** The card now shows a ~420-char plain-text lead (`insightLead()` strips the
markdown and the leading H1), with the full prose behind a native
`<details>`/`<summary>` disclosure. Zero client JS; the stat bands sit right under a
one-glance summary.

### P4 — Sleep debt is a glanceable hero chip

**Problem.** Sleep debt is the single number most likely to drive a RED readiness
gate, but it only appeared inside the collapsed "Why" section. A red hero gave the
verdict without the at-a-glance reason.

**Fix.** `VitalsChips` now emits a **Sleep debt** chip next to Sleep / HRV / RHR,
banded by display thresholds — amber ≥180 min, rose ≥300 min, neutral below. The
thresholds are presentation bands only; the gate itself stays the agent's authored
call (the chip never computes or overrides a verdict).

### P5 — "Training hours" excludes non-endurance types

**Problem.** The summary strip's "Training hours" summed *all* workout durations,
including golf — but golf/walk/mobility/yoga are deliberately excluded from training
*load* (`NON_ENDURANCE_LOAD_TYPES`, fixed in the 06-30 review). So the same golf
round added ~4h to "Training hours" while contributing nothing to CTL. Two headline
numbers, built from the same workouts, disagreed.

**Fix.** `hoursByType` takes an optional `excludeTypes` set and buckets those types
separately, returning `{ entries, totalHours, excludedEntries, excludedHours }`. The
page passes `NON_ENDURANCE_LOAD_TYPES`, so the headline now reflects *endurance*
hours (the set that feeds load) and golf shows as a `+Golf 66h (excl.)` suffix —
visible, but no longer inflating the count. New unit tests cover the split, the
non-positive-duration skip, and the no-exclusion-set default.

---

## Live verification (Chrome MCP on `bi.vardenlab.com/data?view=analyze&days=90`)

All five verified in the browser on the production domain (auth only works there).

- **P4 ✅** — the RED hero renders a rose **`SLEEP DEBT 712 min`** chip inline with
  `SLEEP 7.2 h z+0.1` · `HRV 38 ms z+0.3` · `RHR 59 bpm z−0.1`. The red day now
  carries its driving number at a glance instead of behind the "Why" fold.
- **P5 ✅** — the **Training hours** tile reads **`58`** with the sub
  `Ride 31h · Run 18h · Strength 5.7h · +Golf 69h Walk 2.2… ` — golf/walk are a
  `+…(excl.)` suffix, no longer summed into the headline (which would have read
  ~127h). The Workout-types donut still shows golf's 68.9h, so the raw hours aren't
  lost — they're just not counted as *training* load.
- **P3 ✅** — the **Insights** card shows a ~420-char lead
  ("Window: 90 days … 1. Biggest signal: an aggressive fitness ramp …") with a
  **Show full insight** disclosure; the FITNESS/FORM/ACWR/HRV/SLEEP-DEBT/VO2MAX chip
  strip sits directly beneath it, no longer pushed down by the full essay.
- **P2 ✅** — under Readiness & Recovery, the **Sleep debt** card shows
  **`2 DAYS LOGGED · NEED ≥5 FOR A TREND`** and every **Readiness factors** row
  (HRV z / RHR z / Sleep z) shows **`2 DAYS · NEED ≥5`** instead of a flat 2-point
  line. (The daily-metric **Weight** card independently shows `NEED ≥3 DAYS FOR
  TREND` at n=1 — the pre-existing card-level guard, consistent with the same idea.)
- **P1 ✅** — the **Correlation matrix** renders a compact 3×3 lower triangle of only
  the covered signals (**HRV / Resting HR / Sleep**, n55–56) with the note
  **"5 metrics hidden for insufficient data (e.g. soreness, weight, sleep debt)."**
  instead of an 8×8 grid of mostly-empty cells.

## What this review does *not* fix (data gaps, upstream in the agent)

These are capture-side, not app-side — the app now renders them honestly, but the
data itself is thin because the running dawn-agent fork under-captures. They light up
automatically once the agent captures more; the app can't author the data:

- **`derived_daily` is starved** — sleep-debt / acute-load histories are ~2 points,
  which is exactly why P2's insufficient-data states now fire instead of drawing
  lines. The fix is on the agent (more frequent `log_derived_daily`), surfaced by the
  `/agents` drift banner + the backfill recipe from the prior review.
- **Body-composition & wellness scales barely logged** — `weight_kg`,
  `body_fat_pct`, `soreness` are the metrics P1 now prunes from the heatmap.
- **Vitals only from 2026-05-07** — correlations widen as the window fills; Analyze
  already nudges toward ≥90-day windows.

The net: the surface no longer over-claims on thin data, the load-relevant numbers
agree with each other, and the one signal that drives a red day is visible without a
click.
