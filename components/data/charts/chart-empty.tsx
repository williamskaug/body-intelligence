// Shared low-n / empty placeholder for the stats charts. Plain component so it
// can render inside both server and client trees.
export function ChartEmpty({ label, height = 180 }: { label: string; height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
      style={{ height }}
    >
      {label}
    </div>
  );
}
