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
| Overview | `Trends` (folded in) | `computeBaseline` | all |
| Training load balance | `PerformanceManagementChart` | `get_load_balance` (CTL/ATL/TSB) | endurance + recovery |
| Sleep vs HRV | `MultiSeriesLine` | `get_metric_series` | recovery |
| Correlation matrix | `CorrelationHeatmap` | `get_correlation_matrix` | cross-domain |
| Distributions | `HistogramChart` ×4 | `get_distribution` | recovery + body |
| Relationships worth watching | `ScatterRegression` ×4 | `dailySeriesForMetric` + `linregress`/`pearson` | per pair |
| Notable days | list | `detectAnomalies` + `topAnomalies` | recovery + injury |

**Heatmap metric set:** `hrv_ms`, `rhr_bpm`, `sleep_h`, `derived_sleep_debt_7d_min`,
`derived_acute_load_7d`, `soreness`, `weight_kg`, `body_fat_pct`.

**Relationship pairs:** sleep→next-day HRV (lag 1), acute load→next-day HRV
(lag 1), cadence→vertical oscillation, resting HR→sleep quality.

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
