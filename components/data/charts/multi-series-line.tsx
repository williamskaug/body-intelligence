"use client";

import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartEmpty } from "./chart-empty";

export type SeriesSpec = {
  key: string;
  label: string;
  color: string; // CSS var, e.g. "var(--chart-hrv)"
  axis: "left" | "right";
  kind?: "line" | "area";
};

export type MultiSeriesLineProps = {
  data: ReadonlyArray<Record<string, number | string | null>>; // [{date, hrv, load}]
  series: ReadonlyArray<SeriesSpec>;
  minN?: number;
};

export function MultiSeriesLine({ data, series, minN = 5 }: MultiSeriesLineProps) {
  // Require at least minN rows where some series has a value.
  const filled = data.filter((row) => series.some((s) => row[s.key] != null)).length;
  if (filled < minN) {
    return <ChartEmpty label={`Need ≥${minN} days of overlap`} />;
  }

  const config: ChartConfig = {};
  for (const s of series) config[s.key] = { label: s.label, color: s.color };

  const hasRight = series.some((s) => s.axis === "right");

  return (
    <ChartContainer
      config={config}
      className="aspect-[16/7] w-full"
      initialDimension={{ width: 440, height: 193 }}
    >
      <ComposedChart
        accessibilityLayer
        data={data as Array<Record<string, number | string | null>>}
        margin={{ top: 8, right: hasRight ? 8 : 12, bottom: 4, left: 4 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          minTickGap={32}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis yAxisId="left" tickLine={false} axisLine={false} width={34} />
        {hasRight ? (
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={34}
          />
        ) : null}
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) =>
          s.kind === "area" ? (
            <Area
              key={s.key}
              yAxisId={s.axis}
              type="monotone"
              dataKey={s.key}
              stroke={`var(--color-${s.key})`}
              fill={`var(--color-${s.key})`}
              fillOpacity={0.12}
              strokeWidth={1.6}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : (
            <Line
              key={s.key}
              yAxisId={s.axis}
              type="monotone"
              dataKey={s.key}
              stroke={`var(--color-${s.key})`}
              strokeWidth={1.6}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ),
        )}
      </ComposedChart>
    </ChartContainer>
  );
}
