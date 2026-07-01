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
    ci?: [number, number] | null;
  };
  // Optional r-by-lag profile (the chosen lag is stats.lagDays).
  lagProfile?: ReadonlyArray<{ lag: number; r: number | null }>;
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
  lagProfile,
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
        </span>
        {stats.ci ? (
          <span className="font-mono">
            {" "}
            [{fmtSigned(stats.ci[0], 2)}, {fmtSigned(stats.ci[1], 2)}]
          </span>
        ) : null}{" "}
        · R² {stats.r2 == null ? "—" : stats.r2.toFixed(2)} · n {stats.n}
        {stats.lagDays ? ` · lag ${stats.lagDays}d (strongest of 0–3, CI-checked)` : " · same-day"}
        {stats.ci && stats.ci[0] < 0 && stats.ci[1] > 0 ? " · CI spans 0 (not clear)" : ""}
      </p>
      {lagProfile && lagProfile.length > 1 ? (
        <div className="mt-1.5 flex items-end gap-1" aria-label="correlation strength by lag">
          {lagProfile.map((p) => {
            const mag = p.r == null ? 0 : Math.abs(p.r);
            const chosen = p.lag === stats.lagDays;
            return (
              <div key={p.lag} className="flex flex-col items-center gap-0.5" title={`lag ${p.lag}d: r ${p.r == null ? "n/a" : fmtSigned(p.r)}`}>
                <div className="flex h-6 w-3 items-end">
                  <div
                    className="w-full rounded-sm"
                    style={{
                      height: `${Math.max(6, mag * 100)}%`,
                      backgroundColor:
                        p.r == null
                          ? "var(--muted)"
                          : p.r >= 0
                            ? "var(--chart-pos)"
                            : "var(--chart-neg)",
                      opacity: chosen ? 1 : 0.4,
                    }}
                  />
                </div>
                <span className={`text-[8px] ${chosen ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {p.lag}
                </span>
              </div>
            );
          })}
          <span className="ml-1 self-center text-[9px] text-muted-foreground">|r| by lag (days)</span>
        </div>
      ) : null}
    </div>
  );
}

function fmtSigned(x: number, digits = 2): string {
  const s = x >= 0 ? "+" : "−";
  return `${s}${Math.abs(x).toFixed(digits)}`;
}
