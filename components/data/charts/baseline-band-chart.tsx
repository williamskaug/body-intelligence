"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartEmpty } from "./chart-empty";

// A raw signal vs its own ±1 SD "normal range" band, with today's z-score.
// Strictly descriptive — it shows where you sit relative to your baseline; it
// never emits a green/amber/red readiness gate (that stays the agent's job in
// derived_daily).
export type BaselineBandChartProps = {
  data: ReadonlyArray<{ date: string; value: number | null }>;
  mean: number | null;
  sd: number | null;
  label: string;
  unit?: string;
  color?: string;
  decimals?: number;
  todayZ?: number | null;
  minN?: number;
};

export function BaselineBandChart({
  data,
  mean,
  sd,
  label,
  unit = "",
  color = "var(--chart-hrv)",
  decimals = 0,
  todayZ,
  minN = 5,
}: BaselineBandChartProps) {
  const filled = data.filter((d) => d.value != null).length;
  if (filled < minN || mean == null || sd == null) {
    return <ChartEmpty label={`Need ≥${minN} days`} height={150} />;
  }
  const config = { value: { label, color } } satisfies ChartConfig;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        {todayZ != null ? (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            today {todayZ >= 0 ? "+" : "−"}
            {Math.abs(todayZ).toFixed(1)} SD
          </span>
        ) : null}
      </div>
      <ChartContainer
        config={config}
        className="aspect-[16/6] w-full"
        aria-label={`${label} vs baseline`}
        initialDimension={{ width: 640, height: 240 }}
      >
        <ComposedChart
          accessibilityLayer
          data={data as Array<{ date: string; value: number | null }>}
          margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis tickLine={false} axisLine={false} width={32} domain={["auto", "auto"]} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ReferenceArea
            y1={mean - sd}
            y2={mean + sd}
            fill={color}
            fillOpacity={0.1}
            ifOverflow="hidden"
          />
          <ReferenceLine y={mean} stroke="var(--border)" strokeDasharray="4 2" />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={1.6}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Normal range {(mean - sd).toFixed(decimals)}–{(mean + sd).toFixed(decimals)}
        {unit ? ` ${unit}` : ""} (mean ±1 SD over the window). Descriptive — not a
        readiness gate.
      </p>
    </div>
  );
}
