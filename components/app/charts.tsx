export function SvgBars({
  values,
  labels,
  currentIndex,
  height = 88,
  ariaLabel,
}: {
  values: ReadonlyArray<number>;
  labels?: ReadonlyArray<string>;
  currentIndex?: number;
  height?: number;
  ariaLabel?: string;
}) {
  const n = values.length;
  if (n === 0) return null;
  const max = Math.max(...values, 1);
  const width = 100;
  const gap = 0.35;
  const barW = (width - gap * (n - 1)) / n;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      className="block"
    >
      {values.map((v, i) => {
        const h = (v / max) * (height - 14);
        const x = i * (barW + gap);
        const y = height - 12 - h;
        const current = i === currentIndex;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(h, 0)} fill={current ? "#171717" : "#d4d4d4"} />
            {labels?.[i] ? (
              <text
                x={x + barW / 2}
                y={height - 2}
                textAnchor="middle"
                fontSize={3.2}
                fill="#737373"
              >
                {labels[i]}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function SvgHBars({
  rows,
}: {
  rows: ReadonlyArray<{ label: string; value: number; max: number }>;
}) {
  const max = Math.max(...rows.map((r) => r.max || r.value), 1);
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2 text-[11px]">
          <span className="truncate uppercase tracking-wide text-neutral-500">{r.label}</span>
          <div className="h-2 bg-neutral-100">
            <div className="h-2 bg-neutral-900" style={{ width: `${Math.min(100, (r.value / max) * 100)}%` }} />
          </div>
          <span className="text-right font-mono tabular-nums text-neutral-600">
            {r.value >= 10 ? Math.round(r.value) : r.value.toFixed(1)}h
          </span>
        </div>
      ))}
    </div>
  );
}

export function SvgLine({
  points,
  height = 140,
  stroke = "#2563eb",
  refs,
  yFormat,
}: {
  points: ReadonlyArray<{ x: string; y: number | null }>;
  height?: number;
  stroke?: string;
  fill?: boolean;
  refs?: ReadonlyArray<{ y: number; color?: string; dash?: boolean }>;
  yFormat?: (v: number) => string;
}) {
  const ys = points.map((p) => p.y).filter((v): v is number => v != null && Number.isFinite(v));
  if (ys.length < 2) {
    return <p className="px-3 py-8 text-center text-xs text-muted-foreground">Not enough history yet.</p>;
  }
  const padL = 36;
  const padR = 8;
  const padT = 8;
  const padB = 18;
  const width = 320;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  for (const r of refs ?? []) {
    yMin = Math.min(yMin, r.y);
    yMax = Math.max(yMax, r.y);
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const yPad = (yMax - yMin) * 0.08;
  yMin -= yPad;
  yMax += yPad;
  const x = (i: number) => padL + (innerW * i) / Math.max(1, points.length - 1);
  const y = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  let d = "";
  let pen = false;
  points.forEach((p, i) => {
    if (p.y == null) {
      pen = false;
      return;
    }
    d += pen ? ` L ${x(i)} ${y(p.y)}` : `M ${x(i)} ${y(p.y)}`;
    pen = true;
  });
  const lastIdx = [...points.keys()].reverse().find((i) => points[i]!.y != null);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="block">
      {(refs ?? []).map((r, i) => (
        <line
          key={i}
          x1={padL}
          x2={width - padR}
          y1={y(r.y)}
          y2={y(r.y)}
          stroke={r.color ?? "#e11d48"}
          strokeWidth={1}
          strokeDasharray={r.dash === false ? undefined : "4 3"}
        />
      ))}
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.6} />
      {lastIdx != null && points[lastIdx]!.y != null ? (
        <circle cx={x(lastIdx)} cy={y(points[lastIdx]!.y!)} r={2.4} fill="#171717" />
      ) : null}
      <text x={4} y={y(yMax) + 3} fontSize={7} fill="#737373">
        {yFormat ? yFormat(yMax) : yMax.toFixed(0)}
      </text>
      <text x={4} y={y(yMin) + 3} fontSize={7} fill="#737373">
        {yFormat ? yFormat(yMin) : yMin.toFixed(0)}
      </text>
    </svg>
  );
}

export function SvgStackedWeekly({
  series,
  labels,
  currentIndex,
  height = 120,
  colors,
}: {
  series: ReadonlyArray<ReadonlyArray<number>>;
  labels: ReadonlyArray<string>;
  currentIndex?: number;
  height?: number;
  colors: ReadonlyArray<string>;
}) {
  const n = labels.length;
  if (n === 0) return null;
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s[i] ?? 0), 0));
  const max = Math.max(...totals, 1);
  const width = 100;
  const gap = 0.3;
  const barW = (width - gap * (n - 1)) / n;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="block">
      {labels.map((label, i) => {
        const x = i * (barW + gap);
        let y = height - 12;
        return (
          <g key={label}>
            {series.map((s, si) => {
              const v = s[i] ?? 0;
              const h = (v / max) * (height - 16);
              y -= h;
              return (
                <rect
                  key={si}
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(h, 0)}
                  fill={i === currentIndex && si === 0 ? "#171717" : colors[si] ?? "#a3a3a3"}
                />
              );
            })}
            <text x={x + barW / 2} y={height - 2} textAnchor="middle" fontSize={3} fill="#737373">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
