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

export type RatioBandChartProps = {
  data: ReadonlyArray<{ date: string; value: number | null }>;
  band: [number, number]; // descriptive reference band (a constant range)
  refLine?: number; // e.g. 1.0
  label: string;
  color?: string;
  minN?: number;
};

export function RatioBandChart({
  data,
  band,
  refLine,
  label,
  color = "var(--chart-load)",
  minN = 14,
}: RatioBandChartProps) {
  const filled = data.filter((d) => d.value != null).length;
  if (filled < minN) {
    return <ChartEmpty label={`Need ≥${minN} days of load history`} />;
  }
  const config = { value: { label, color } } satisfies ChartConfig;

  return (
    <ChartContainer
      config={config}
      className="aspect-[16/6] w-full"
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
        <YAxis tickLine={false} axisLine={false} width={30} domain={[0, "auto"]} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ReferenceArea
          y1={band[0]}
          y2={band[1]}
          fill="var(--chart-pos)"
          fillOpacity={0.08}
          ifOverflow="hidden"
        />
        {refLine != null ? (
          <ReferenceLine y={refLine} stroke="var(--border)" strokeDasharray="4 2" />
        ) : null}
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--color-value)"
          strokeWidth={1.8}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
