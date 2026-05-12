export type DocumentRow = {
  path: string;
  content: string;
  updated_at: string;
};

export function Documents({ rows }: { rows: ReadonlyArray<DocumentRow> }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-8 text-center text-sm text-muted-foreground shadow-sm">
        No memory documents yet — these are normally seeded on signup.
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((doc) => (
        <details
          key={doc.path}
          className="group rounded-xl border bg-card shadow-sm transition-shadow open:shadow-md"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="flex flex-col">
              <span className="font-mono text-sm font-medium">{doc.path}</span>
              <span className="text-xs text-muted-foreground">
                {previewFirstLine(doc.content)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
              <span>{timeAgo(doc.updated_at)}</span>
              <span>{wordCount(doc.content)} words</span>
            </div>
          </summary>
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-b-xl border-t bg-muted/20 px-4 py-3 font-mono text-xs leading-relaxed">
            {doc.content}
          </pre>
        </details>
      ))}
    </div>
  );
}

function previewFirstLine(content: string): string {
  const line = content
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find((l) => l.length > 0);
  if (!line) return "(empty)";
  return line.length > 70 ? `${line.slice(0, 70)}…` : line;
}

function wordCount(content: string): number {
  const m = content.trim().match(/\S+/g);
  return m ? m.length : 0;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}
