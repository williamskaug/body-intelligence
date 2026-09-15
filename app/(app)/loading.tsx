export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-50">
      <div className="h-11 shrink-0 border-b border-neutral-200 bg-white" />
      <div className="h-9 shrink-0 border-b border-neutral-200 bg-white" />
      <div className="grid flex-1 grid-cols-2 gap-px bg-neutral-200 p-px @5xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="min-h-16 animate-pulse bg-white" />
        ))}
      </div>
      <div className="grid flex-[2] gap-px bg-neutral-200 p-px @5xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="min-h-40 animate-pulse bg-white" />
        ))}
      </div>
    </div>
  );
}
