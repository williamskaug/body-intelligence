export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-50">
      <div className="h-0.5 w-full animate-pulse bg-neutral-300" />
      <div className="grid flex-1 grid-cols-2 gap-px p-px @xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="min-h-24 animate-pulse bg-white" />
        ))}
      </div>
    </div>
  );
}
