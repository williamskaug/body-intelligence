export type BarStackDatum = {
  x: string;
  segments: ReadonlyArray<{ key: string; value: number; color: string }>;
};

// Server-rendered stacked bar chart (weekly training load by type).
// Native <title> tooltips per segment; no client JS.
export function BarStack({
  data,
  width = 460,
  height = 96,
  ariaLabel,
}: {
  data: ReadonlyArray<BarStackDatum>;
  width?: number;
  height?: number;
  ariaLabel?: string;
}) {
  const pad = 2;
  const n = data.length;
  if (n === 0) return null;
  const totals = data.map((d) => d.segments.reduce((a, s) => a + s.value, 0));
  const maxTotal = Math.max(...totals, 1);
  const gap = 4;
  const barW = (width - pad * 2 - gap * (n - 1)) / n;
  const innerH = height - pad * 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      {data.map((d, i) => {
        const x = pad + i * (barW + gap);
        let yCursor = height - pad;
        return (
          <g key={d.x}>
            {d.segments.map((s) => {
              const h = (s.value / maxTotal) * innerH;
              yCursor -= h;
              return (
                <rect
                  key={s.key}
                  x={x}
                  y={yCursor}
                  width={barW}
                  height={Math.max(h, s.value > 0 ? 1 : 0)}
                  fill={s.color}
                  rx={1}
                >
                  <title>{`${d.x} · ${s.key}: ${Math.round(s.value)}`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
