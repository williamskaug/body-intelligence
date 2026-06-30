"use client";

import {
  Area,
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartEmpty } from "./chart-empty";

export type PerformanceManagementChartProps = {
  data: ReadonlyArray<{
    date: string;
    ctl: number | null;
    atl: number | null;
    tsb: number | null;
  }>;
  ramp?: number | null; // ctl_ramp_7d
  minDays?: number;
};

const config = {
  tsb: { label: "Form (TSB)", color: "var(--chart-tsb)" },
  ctl: { label: "Fitness (CTL)", color: "var(--chart-ctl)" },
  atl: { label: "Fatigue (ATL)", color: "var(--chart-atl)" },
} satisfies ChartConfig;

export function PerformanceManagementChart({
  data,
  ramp,
  minDays = 14,
}: PerformanceManagementChartProps) {
  if (data.length < minDays) {
    return <ChartEmpty label={`Need ≥${minDays} days of load history`} />;
  }
  const last = data[data.length - 1];

  return (
    <div>
      <ChartContainer config={config} className="aspect-[16/7] w-full">
        <ComposedChart
          accessibilityLayer
          data={data as Array<{ date: string; ctl: number | null; atl: number | null; tsb: number | null }>}
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
          <YAxis yAxisId="load" tickLine={false} axisLine={false} width={34} />
          <YAxis
            yAxisId="form"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={34}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {/* Descriptive TSB context bands (fixed constants): high-fatigue
              below −10, fresh above +5. Context only — not a recommendation. */}
          <ReferenceArea
            yAxisId="form"
            y1={-1000}
            y2={-10}
            fill="var(--chart-atl)"
            fillOpacity={0.06}
            ifOverflow="hidden"
          />
          <ReferenceArea
            yAxisId="form"
            y1={5}
            y2={1000}
            fill="var(--chart-tsb)"
            fillOpacity={0.06}
            ifOverflow="hidden"
          />
          <ReferenceLine yAxisId="form" y={0} stroke="var(--border)" />
          <Area
            yAxisId="form"
            type="monotone"
            dataKey="tsb"
            stroke="var(--color-tsb)"
            fill="var(--color-tsb)"
            fillOpacity={0.12}
            strokeWidth={1.2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            yAxisId="load"
            type="monotone"
            dataKey="ctl"
            stroke="var(--color-ctl)"
            strokeWidth={1.8}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            yAxisId="load"
            type="monotone"
            dataKey="atl"
            stroke="var(--color-atl)"
            strokeWidth={1.4}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
      {last ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          <span className="font-mono">CTL {fmt(last.ctl)}</span> ·{" "}
          <span className="font-mono">ATL {fmt(last.atl)}</span> ·{" "}
          <span className="font-mono">TSB {fmtSigned(last.tsb)}</span>
          {ramp != null ? (
            <>
              {" "}
              · <span className="font-mono">ramp {fmtSigned(ramp)}/wk</span>
            </>
          ) : null}{" "}
          — fitness, fatigue, form, and 7-day fitness ramp (load statistics, not a
          verdict). Shaded: high-fatigue (below) / fresh (above).
        </p>
      ) : null}
    </div>
  );
}

function fmt(x: number | null): string {
  return x == null ? "—" : Math.round(x).toString();
}
function fmtSigned(x: number | null): string {
  if (x == null) return "—";
  return `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x))}`;
}
