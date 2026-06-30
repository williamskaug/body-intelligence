import Link from "next/link";
import { metricLabel } from "@/lib/data-display/metric-registry";
import { ChartEmpty } from "./chart-empty";

// Recharts has no heatmap primitive, so the correlation matrix is an accessible
// CSS-grid table — server-rendered, zero client JS. Columns are headed by index
// (1..N) to stay compact; each body row carries the full metric label.

export type CorrelationHeatmapProps = {
  metrics: ReadonlyArray<string>; // metric keys, matrix order
  matrix: ReadonlyArray<ReadonlyArray<number | null>>; // r in [-1,1] or null
  n: ReadonlyArray<ReadonlyArray<number>>; // pairwise sample counts
};

// Saturation ∝ |r|, dampened by a confidence factor so a 4-pair r doesn't look
// as strong as a 100-pair r (it fades toward transparent below ~12 pairs).
function cellStyle(r: number | null, n: number): React.CSSProperties {
  if (r == null) return {};
  const conf = Math.min(1, n / 12);
  const pct = Math.round(Math.abs(r) * conf * 100);
  const base = r >= 0 ? "var(--chart-pos)" : "var(--chart-neg)";
  return { backgroundColor: `color-mix(in oklab, ${base} ${pct}%, transparent)` };
}

export function CorrelationHeatmap({ metrics, matrix, n }: CorrelationHeatmapProps) {
  if (metrics.length < 3) {
    return <ChartEmpty label="Not enough overlapping history for a correlation matrix yet." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card" />
            {metrics.map((_, j) => (
              <th
                key={j}
                scope="col"
                className="h-6 w-9 text-center font-mono text-muted-foreground"
              >
                {j + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((mi, i) => (
            <tr key={mi}>
              <th
                scope="row"
                className="sticky left-0 whitespace-nowrap bg-card pr-2 text-left font-normal"
              >
                <Link
                  href={`/data/metric/${mi}`}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  {i + 1}. {metricLabel(mi)}
                </Link>
              </th>
              {matrix[i]!.map((r, j) => {
                // Lower triangle only — the upper triangle is the mirror image
                // and the diagonal is a trivial r=1.
                if (j > i) return <td key={j} className="h-10 w-9" />;
                if (i === j) {
                  return (
                    <td key={j} className="h-10 w-9 text-center align-middle text-muted-foreground/30">
                      —
                    </td>
                  );
                }
                const nij = n[i]?.[j] ?? 0;
                return (
                  <td
                    key={j}
                    className="h-10 w-9 rounded text-center align-middle"
                    style={cellStyle(r, nij)}
                    title={`${metricLabel(mi)} × ${metricLabel(metrics[j]!)}: r=${
                      r == null ? "n/a" : r.toFixed(2)
                    }, n=${nij}`}
                  >
                    <div className="font-mono text-[11px] leading-tight tabular-nums">
                      {r == null ? "·" : r.toFixed(2)}
                    </div>
                    <div className="text-[8px] leading-tight text-muted-foreground">n{nij}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Pearson r over the window across {(metrics.length * (metrics.length - 1)) / 2} pairs.{" "}
        <span className="text-emerald-500">green = positive</span>,{" "}
        <span className="text-rose-500">red = negative</span>; saturation ∝ |r| ×
        confidence (cells under ~12 paired days are faded). A coefficient, not
        causation — with this many pairs, expect some to look strong by chance.
      </p>
    </div>
  );
}
