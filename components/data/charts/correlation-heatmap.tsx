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

function cellStyle(r: number | null): React.CSSProperties {
  if (r == null) return {};
  const pct = Math.round(Math.abs(r) * 100);
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
              {matrix[i]!.map((r, j) => (
                <td
                  key={j}
                  className="h-9 w-9 rounded text-center font-mono tabular-nums"
                  style={cellStyle(r)}
                  title={`${metricLabel(mi)} × ${metricLabel(metrics[j]!)}: r=${
                    r == null ? "n/a" : r.toFixed(2)
                  }, n=${n[i]?.[j] ?? 0}`}
                >
                  {r == null ? "·" : r.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Pearson r over the window.{" "}
        <span className="text-emerald-500">green = positive</span>,{" "}
        <span className="text-rose-500">red = negative</span>; saturation ∝ |r|. A
        coefficient, not causation.
      </p>
    </div>
  );
}
