"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartEmpty } from "./chart-empty";

export type HistogramChartProps = {
  bins: ReadonlyArray<{ binStart: number; binEnd: number; count: number }>;
  percentiles: { p5: number | null; p50: number | null; p95: number | null };
  label: string;
  decimals?: number;
  latest?: number | null; // draws a "you are here" marker + percentile caption
  minN?: number;
};

const config = { count: { label: "Days", color: "var(--chart-1)" } } satisfies ChartConfig;

export function HistogramChart({
  bins,
  percentiles,
  label,
  decimals = 1,
  latest,
  minN = 8,
}: HistogramChartProps) {
  const total = bins.reduce((a, b) => a + b.count, 0);
  if (total < minN || bins.length === 0) {
    return <ChartEmpty label={`Need ≥${minN} days`} />;
  }

  const data = bins.map((b) => ({
    mid: (b.binStart + b.binEnd) / 2,
    label: b.binStart.toFixed(decimals),
    count: b.count,
  }));
  const latestPct = latest != null ? approxPercentile(bins, latest) : null;

  return (
    <div>
      <ChartContainer config={config} className="aspect-[4/3] w-full" aria-label={`${label} distribution`}>
        <BarChart accessibilityLayer data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <ChartTooltip
            cursor={{ fill: "var(--muted)" }}
            content={<ChartTooltipContent labelKey="label" nameKey="count" />}
          />
          {percentiles.p50 != null ? (
            <ReferenceLine x={nearestLabel(data, percentiles.p50)} stroke="var(--chart-pos)" strokeDasharray="4 2" />
          ) : null}
          {latest != null ? (
            <ReferenceLine
              x={nearestLabel(data, latest)}
              stroke="var(--chart-point)"
              strokeWidth={1.8}
              label={{ value: "you", position: "top", fontSize: 10, fill: "var(--chart-point)" }}
            />
          ) : null}
          <Bar dataKey="count" fill="var(--color-count)" radius={2} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
      {latest != null && latestPct != null ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Latest {latest.toFixed(decimals)} — about p{latestPct} of your window range.
        </p>
      ) : null}
    </div>
  );
}

// Approximate the percentile rank of `value` from the binned counts (we don't
// keep raw values in the chart). Linear within the containing bin.
function approxPercentile(
  bins: ReadonlyArray<{ binStart: number; binEnd: number; count: number }>,
  value: number,
): number | null {
  const total = bins.reduce((a, b) => a + b.count, 0);
  if (total === 0) return null;
  let below = 0;
  for (const b of bins) {
    if (value >= b.binEnd) {
      below += b.count;
    } else if (value > b.binStart) {
      const frac = (value - b.binStart) / Math.max(1e-9, b.binEnd - b.binStart);
      below += b.count * frac;
      break;
    } else {
      break;
    }
  }
  return Math.max(0, Math.min(100, Math.round((below / total) * 100)));
}

// Map a percentile value to the nearest bin label so the ReferenceLine lands on
// a categorical X tick (BarChart X is categorical here).
function nearestLabel(
  data: ReadonlyArray<{ mid: number; label: string }>,
  value: number,
): string | undefined {
  let best: { label: string; d: number } | null = null;
  for (const d of data) {
    const dist = Math.abs(d.mid - value);
    if (best == null || dist < best.d) best = { label: d.label, d: dist };
  }
  return best?.label;
}
