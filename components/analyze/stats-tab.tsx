import { EmptyNote, Panel, PanelHeader } from "@/components/app/panel";
import { CorrelationHeatmap } from "@/components/data/charts/correlation-heatmap";
import { HistogramChart, RatioBandChart } from "@/components/analyze/lazy-charts";
import type { AnalyzeExtras } from "@/lib/app/analyze-extras";
import { metricLabel } from "@/lib/data-display/metric-registry";
import { toHistBins } from "./analyze-helpers";

export function StatsTab({ extras }: { extras: AnalyzeExtras }) {
  const acwr = (extras.load?.series ?? []).map((s) => ({ date: s.date, value: s.acwr }));
  return (
    <div className="grid gap-px bg-neutral-200 @5xl:grid-cols-3">
      <Panel>
        <PanelHeader title="Correlation matrix" />
        <div className="p-2">
          {extras.matrix ? (
            <CorrelationHeatmap
              metrics={extras.matrix.metrics}
              matrix={extras.matrix.matrix}
              n={extras.matrix.n}
            />
          ) : (
            <EmptyNote>Need overlapping history.</EmptyNote>
          )}
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Acute : chronic" />
        <div className="p-2">
          <RatioBandChart data={acwr} band={[0.8, 1.3]} refLine={1} label="ACWR" />
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Distributions" />
        <div className="grid gap-3 p-2">
          {extras.dists.map((d, i) =>
            d ? (
              <div key={i}>
                <div className="mb-1 text-[11px] font-medium">{metricLabel(d.metric)}</div>
                <HistogramChart
                  bins={toHistBins(d.histogram)}
                  percentiles={{ p5: d.percentiles.p5, p50: d.percentiles.p50, p95: d.percentiles.p95 }}
                  latest={d.latest}
                  label={metricLabel(d.metric)}
                />
              </div>
            ) : null,
          )}
        </div>
      </Panel>
    </div>
  );
}
