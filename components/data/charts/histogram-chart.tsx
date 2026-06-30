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
  minN?: number;
};

const config = { count: { label: "Days", color: "var(--chart-1)" } } satisfies ChartConfig;

export function HistogramChart({
  bins,
  percentiles,
  label,
  decimals = 1,
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

  return (
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
        <Bar dataKey="count" fill="var(--color-count)" radius={2} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
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
