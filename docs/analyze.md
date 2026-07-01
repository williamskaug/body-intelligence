# The Analyze view + statistics engine

The `/data?view=analyze` surface and the per-metric drilldown (`/data/metric/[key]`)
are BI's statistical layer. They render **deterministic statistics** computed
server-side; they never author a verdict. The "what to optimize" reasoning lives
in the `insights` recipe (Claude), surfaced as the Insights band atop Analyze.

`?view=trends` is kept as an alias for `?view=analyze` so old links don't 404.

## The chart boundary (deliberate departure)

Charts are a hybrid:

- **Inline / glanceable** micro-charts stay hand-rolled server-rendered SVG —
  `components/data/{sparkline,bar-stack,gate-strip}.tsx`, zero client JS.
- **Analyze + drilldown** use **shadcn charts (Recharts v3)** —
  `components/ui/chart.tsx` + `components/data/charts/*`, `"use client"`. Data is
  fetched and **all statistics are computed server-side**, then passed as plain
  serializable props. No statistics run in the browser.
- `CorrelationHeatmap` is the one "chart" that stays a **server CSS-grid
  `<table>`** — Recharts has no heatmap primitive, and a table is accessible and
  zero-JS.

This is a scoped break from the old "no chart library, zero client JS" rule, made
because a richer statistical view (scatter, distributions, dual-axis overlays,
the fitness/fatigue/form chart) earns the interactivity on these two surfaces.

## Where the math lives

- `lib/data-display/statistics.ts` — pure, exhaustively unit-tested: `pearson`,
  `spearman`, `linregress`, `ewma`, `percentile`/`quantiles`, `histogram`,
  `alignByDate` (with lag), `correlationReport`. All return `null` on n<3 / zero
  variance — never NaN.
- `lib/data-display/metric-series.ts` — the DB→series bridge:
  `dailySeriesForMetric`, `defaultDailyAgg`/`collapseDaily`, `dailyImpulseSeries`
  (`vendor_training_load ?? duration*(rpe??5)`), `multiSeries`. Backs both the MCP
  tools and the charts.
- The six MCP tools (`get_correlation`, `get_correlation_matrix`,
  `get_distribution`, `get_trend`, `get_load_balance`, `get_metric_series`) are
  thin wrappers over those libs. The Analyze server component calls them directly
  with the user id.

## Analyze bands (card → stat → domain)

| Band | Component | Stat source | Domain |
|------|-----------|-------------|--------|
| Insights | `InsightsFeed` | `insights/` markdown (Claude) | all |
| Headline strip | inline stat chips | `get_load_balance.current` + baseline deltas + capacity latest | all |
| Notable days | list | `detectAnomalies` + `topAnomalies` | recovery + injury |
| Overview | `Trends` (folded in) | `computeBaseline` (+ Δ arrows, sleep architecture) | all |
| Training load balance | `PerformanceManagementChart` | `get_load_balance` (CTL/ATL/TSB + TSB context bands, ramp, monotony/strain, load-source provenance) | endurance + recovery |
| Acute:chronic ratio | `RatioBandChart` | `get_load_balance` acwr + constant 0.8–1.3 band | injury |
| Fitness & capacity | `MultiSeriesLine` + tiles | `get_metric_series` over `capacity_*` | endurance |
| Intensity distribution | inline stacked bar | summed `workout_hr_z*_s` (80/20 polarization) | endurance |
| Sleep vs HRV | `MultiSeriesLine` | `get_metric_series` | recovery |
| Recovery baselines | `BaselineBandChart` ×3 | `computeBaseline` ±1 SD band + today z (descriptive, never a gate) | recovery |
| Correlation matrix | `CorrelationHeatmap` | `get_correlation_matrix` (lower triangle, n shown, low-n faded) | cross-domain |
| Distributions | `HistogramChart` ×4 | `get_distribution` (+ "you are here" percentile) | recovery + body |
| Relationships worth watching | `ScatterRegression` ×4 | `dailySeriesForMetric` + `lagScan` (best of lags 0–3) + `linregress`/`pearson` | per pair |

**Load impulse precedence:** Edwards zone-weighted TRIMP (HR zones) → vendor
training load → duration×(rpe??5)/2 (the fallback is halved to keep the three
sources on a comparable TRIMP scale); `load_sources` reports the per-source
counts. **Non-endurance types (golf/walk/mobility/yoga) are excluded** from the
impulse so they don't inflate CTL/ATL/TSB (`workouts_excluded`). Recovery
baselines use a fixed 60-day window with a leave-one-out z (independent of the
display toggle), and relationship lag-scans anchor on lag 0 with a Fisher-z CI.

**Heatmap metric set:** `hrv_ms`, `rhr_bpm`, `sleep_h`, `derived_sleep_debt_7d_min`,
`derived_acute_load_7d`, `soreness`, `weight_kg`, `body_fat_pct`.

**Relationship pairs (lag auto-scanned 0–3):** sleep→HRV, acute load→soreness,
heat→HR-pace decoupling, resting HR→sleep quality.

## min-n / resilience

- Every chart self-gates on a minimum sample size and renders a low-n placeholder
  rather than an empty axis (scatter ≥10 pairs, histogram ≥8, overlay ≥5, PMC
  ≥14 days, heatmap ≥3 surviving metrics).
- Each stat call in `analyze.tsx` is wrapped in `safe()` so a not-yet-applied
  migration or an empty table degrades the band, never 500s the page.
- The PMC fetches a 42-day warm-up before the displayed window so the CTL EWMA is
  primed (independent of the `?days` picker).
- Analyze nudges toward ≥90-day windows (a hint banner under 90d) because wider
  windows give steadier correlations.

## Per-metric drilldown

`/data/metric/[key]` (key ∈ `METRIC_KEYS`, label/unit/direction from
`lib/data-display/metric-registry.ts`): summary stats, full-history trend
(`get_trend` caption over `get_metric_series`), distribution (`get_distribution`),
and top correlates (this metric's row of `get_correlation_matrix`, ranked by |r|,
each linking onward). Unknown keys → `notFound()`.
