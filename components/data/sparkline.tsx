import { movingAverage } from "@/lib/data-display/aggregate";
import type { Baseline } from "@/lib/data-display/baseline";

export type RefLine = {
  y: number;
  label?: string;
  tone?: "neutral" | "warn";
};

export type SparklineProps = {
  values: ReadonlyArray<number | null>;
  baseline?: Baseline | null;
  width?: number;
  height?: number;
  // Color of the moving-average line / dots. Default uses primary.
  stroke?: string;
  ariaLabel?: string;
  /** Horizontal reference lines (thresholds, zero-lines). */
  refLines?: ReadonlyArray<RefLine>;
  /** Fixed y-domain (e.g. [1, 5] for severity). Defaults to data-driven. */
  yDomain?: readonly [number, number];
  /** Fill the area between the MA line and the bottom (sleep-debt style). */
  fillArea?: boolean;
};

// Pure server-rendered SVG sparkline:
//   • faint baseline band at mean ± 1 SD,
//   • light dots for raw values,
//   • 7-day moving average line on top.
export function Sparkline({
  values,
  baseline,
  width = 220,
  height = 56,
  stroke = "currentColor",
  ariaLabel,
  refLines,
  yDomain,
  fillArea = false,
}: SparklineProps) {
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const n = values.length;

  // Y-domain: use baseline ±2 SD if available, else min/max of raw + MA.
  const ma = movingAverage(values, 7);
  const finite = (xs: ReadonlyArray<number | null>): number[] =>
    xs.filter((v): v is number => v != null && Number.isFinite(v));
  const all = [...finite(values), ...finite(ma)];
  if (all.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        aria-label={ariaLabel ?? "No data"}
        role="img"
        className="text-muted-foreground/40"
      >
        <line
          x1={pad}
          x2={width - pad}
          y1={height / 2}
          y2={height / 2}
          stroke="currentColor"
          strokeDasharray="2 3"
          strokeWidth={1}
        />
      </svg>
    );
  }

  let yMin: number;
  let yMax: number;
  if (yDomain) {
    [yMin, yMax] = yDomain;
  } else if (baseline) {
    const span = Math.max(baseline.sd * 2.2, (Math.max(...all) - Math.min(...all)) * 0.6, 0.5);
    yMin = Math.min(Math.min(...all), baseline.mean - span);
    yMax = Math.max(Math.max(...all), baseline.mean + span);
  } else {
    yMin = Math.min(...all);
    yMax = Math.max(...all);
  }
  if (refLines) {
    for (const r of refLines) {
      yMin = Math.min(yMin, r.y);
      yMax = Math.max(yMax, r.y);
    }
  }
  if (yMin === yMax) {
    yMin -= 0.5;
    yMax += 0.5;
  }

  const x = (i: number) => pad + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v: number) => pad + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const linePath = buildPath(ma, x, y);

  // Baseline band ±1 SD
  const bandTop = baseline ? y(baseline.mean + baseline.sd) : null;
  const bandBottom = baseline ? y(baseline.mean - baseline.sd) : null;
  const meanY = baseline ? y(baseline.mean) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-label={ariaLabel}
      role="img"
      className="overflow-visible"
    >
      {bandTop != null && bandBottom != null ? (
        <rect
          x={pad}
          y={Math.min(bandTop, bandBottom)}
          width={innerW}
          height={Math.abs(bandBottom - bandTop)}
          fill={stroke}
          opacity={0.06}
          rx={2}
        />
      ) : null}
      {meanY != null ? (
        <line
          x1={pad}
          x2={width - pad}
          y1={meanY}
          y2={meanY}
          stroke={stroke}
          strokeWidth={1}
          strokeDasharray="2 3"
          opacity={0.35}
        />
      ) : null}
      {refLines?.map((r, i) => (
        <g key={`ref-${i}`}>
          <line
            x1={pad}
            x2={width - pad}
            y1={y(r.y)}
            y2={y(r.y)}
            stroke={r.tone === "warn" ? "hsl(35 90% 50%)" : stroke}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={r.tone === "warn" ? 0.55 : 0.3}
          />
          {r.label ? (
            <text
              x={width - pad}
              y={y(r.y) - 2}
              textAnchor="end"
              fontSize={7}
              fill={r.tone === "warn" ? "hsl(35 90% 45%)" : stroke}
              opacity={0.7}
            >
              {r.label}
            </text>
          ) : null}
        </g>
      ))}
      {fillArea && linePath ? (
        <path
          d={`${linePath} L ${x(lastFiniteIndex(ma))} ${height - pad} L ${x(firstFiniteIndex(ma))} ${height - pad} Z`}
          fill={stroke}
          opacity={0.1}
        />
      ) : null}
      {values.map((v, i) =>
        v != null && Number.isFinite(v) ? (
          <circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={1.6}
            fill={stroke}
            opacity={0.35}
          />
        ) : null,
      )}
      {linePath ? (
        <path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

function firstFiniteIndex(values: ReadonlyArray<number | null>): number {
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) return i;
  }
  return 0;
}

function lastFiniteIndex(values: ReadonlyArray<number | null>): number {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) return i;
  }
  return values.length - 1;
}

function buildPath(
  values: ReadonlyArray<number | null>,
  x: (i: number) => number,
  y: (v: number) => number,
): string {
  let d = "";
  let pen = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) {
      pen = false;
      continue;
    }
    d += pen ? ` L ${x(i)} ${y(v)}` : `M ${x(i)} ${y(v)}`;
    pen = true;
  }
  return d;
}
