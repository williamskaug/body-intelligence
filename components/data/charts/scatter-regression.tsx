"use client";

import {
  CartesianGrid,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartEmpty } from "./chart-empty";

export type ScatterRegressionProps = {
  points: ReadonlyArray<{ x: number; y: number; date: string }>;
  // Regression endpoints in data coords (from Pillar-2 OLS), or null.
  line: { x1: number; y1: number; x2: number; y2: number } | null;
  stats: {
    r: number | null;
    r2: number | null;
    slope: number | null;
    n: number;
    lagDays?: number;
  };
  xLabel: string;
  yLabel: string;
  minN?: number;
};

type TipPayload = { payload?: { x: number; y: number; date: string } };

function ScatterTip({
  active,
  payload,
  xLabel,
  yLabel,
}: {
  active?: boolean;
  payload?: TipPayload[];
  xLabel: string;
  yLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{p.date}</div>
      <div className="text-muted-foreground">
        {xLabel}: <span className="font-mono text-foreground">{p.x}</span>
      </div>
      <div className="text-muted-foreground">
        {yLabel}: <span className="font-mono text-foreground">{p.y}</span>
      </div>
    </div>
  );
}

export function ScatterRegression({
  points,
  line,
  stats,
  xLabel,
  yLabel,
  minN = 10,
}: ScatterRegressionProps) {
  if (points.length < minN) {
    return <ChartEmpty label={`Need ≥${minN} paired days`} />;
  }

  const config = { y: { label: yLabel, color: "var(--chart-point)" } } satisfies ChartConfig;
  const rTone =
    stats.r == null ? "text-muted-foreground" : stats.r >= 0 ? "text-emerald-500" : "text-rose-500";

  return (
    <div>
      <ChartContainer config={config} className="aspect-[4/3] w-full">
        <ScatterChart accessibilityLayer margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            domain={["dataMin", "dataMax"]}
            tickLine={false}
            axisLine={false}
            tickCount={5}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            domain={["dataMin", "dataMax"]}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <ChartTooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={<ScatterTip xLabel={xLabel} yLabel={yLabel} />}
          />
          {line ? (
            <ReferenceLine
              segment={[
                { x: line.x1, y: line.y1 },
                { x: line.x2, y: line.y2 },
              ]}
              stroke="var(--chart-fit)"
              strokeWidth={1.6}
              ifOverflow="extendDomain"
            />
          ) : null}
          <Scatter
            data={points as Array<{ x: number; y: number; date: string }>}
            fill="var(--color-y)"
            isAnimationActive={false}
            fillOpacity={0.6}
          />
        </ScatterChart>
      </ChartContainer>
      <p className="mt-1 text-[11px] text-muted-foreground">
        <span className={`font-mono ${rTone}`}>
          r {stats.r == null ? "—" : fmtSigned(stats.r)}
        </span>{" "}
        · R² {stats.r2 == null ? "—" : stats.r2.toFixed(2)} · slope{" "}
        {stats.slope == null ? "—" : fmtSigned(stats.slope, 3)} · n {stats.n}
        {stats.lagDays ? ` · lag ${stats.lagDays}d` : ""}
      </p>
    </div>
  );
}

function fmtSigned(x: number, digits = 2): string {
  const s = x >= 0 ? "+" : "−";
  return `${s}${Math.abs(x).toFixed(digits)}`;
}
