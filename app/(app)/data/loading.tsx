export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4">
        <div>
          <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
          <div className="mt-3 h-4 w-72 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-9 w-60 animate-pulse rounded-lg bg-muted" />
          <div className="h-7 w-44 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-muted/70"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
