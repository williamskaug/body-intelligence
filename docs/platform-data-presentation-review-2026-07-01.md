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

## Live verification

Verification on `bi.vardenlab.com` (auth only works on the custom domain) was
**pending at the time of writing** — the Chrome extension was unresponsive (a
permission prompt appeared to be pending in its side panel). The five fixes are
deployed (`platform-improvements → main`, Vercel auto-deploy) and pass the full local
gate suite. Live browser evidence will be appended here once the extension is
available; each fix's on-screen expectation:

- **P1** — `/data?view=analyze`: the correlation heatmap shows only well-covered
  metrics (HRV / RHR / sleep / derived load), with a "N metrics hidden" note.
- **P2** — the sleep-debt and readiness-factor cards show "N days · need ≥5" where a
  flat 2-point line used to be.
- **P3** — the Insights card shows a short lead with a "Show full insight" toggle;
  the PMC chart sits just below it.
- **P4** — the hero shows a "Sleep debt … min" chip (rose today, given the RED gate).
- **P5** — the "Training hours" tile reads the endurance-only total with a
  "+Golf …h (excl.)" suffix.

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
