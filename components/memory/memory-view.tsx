"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMemoryDoc } from "@/app/(app)/actions";
import { Markdown } from "@/components/data/markdown";
import { formatBytes } from "@/lib/app/format";
import { cn } from "@/lib/utils";

export type MemoryFile = {
  path: string;
  updated_at: string;
};

const STANDARD = [
  "MEMORY.md",
  "PROFILE.md",
  "PRINCIPLES.md",
  "GOALS.md",
  "CURRENT.md",
  "HEALTH_LOG.md",
  "NUTRITION.md",
  "EQUIPMENT.md",
  "THRESHOLDS.md",
  "RECORDS.md",
];

export function MemoryView({
  files,
  selectedPath,
  content,
  updatedAt,
}: {
  files: MemoryFile[];
  selectedPath: string;
  content: string;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [mode, setMode] = useState<"raw" | "rendered">("rendered");
  const [draft, setDraft] = useState(content);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, filter]);

  const folders = groupFiles(visible);

  return (
    <div className="grid h-full min-h-0 min-w-0 @3xl:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)]">
      <aside className="flex min-h-0 min-w-0 flex-col border-r border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 p-2">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter files…"
            className="w-full border border-neutral-300 px-2 py-1 text-[12px] outline-none focus:border-neutral-500"
          />
        </div>
        <nav className="min-h-0 flex-1 overflow-auto py-1 text-[12px]">
          {folders.map((group) => (
            <div key={group.label} className="mb-1">
              {group.label !== "root" ? (
                <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-neutral-400">
                  {group.label}/
                </div>
              ) : null}
              {group.files.map((f) => {
                const name = group.label === "root" ? f.path : f.path.slice(group.label.length + 1);
                const active = f.path === selectedPath;
                return (
                  <button
                    key={f.path}
                    type="button"
                    className={cn(
                      "flex w-full min-w-0 px-3 py-1 text-left font-mono text-[11px]",
                      active ? "bg-foreground text-background" : "hover:bg-neutral-50",
                    )}
                    onClick={() => router.push(`/memory?path=${encodeURIComponent(f.path)}`)}
                  >
                    <span className="min-w-0 truncate">{name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2">
          <div>
            <h2 className="min-w-0 break-all font-mono text-[13px] font-semibold">{selectedPath}</h2>
            <p className="font-mono text-[10px] text-neutral-500">
              {updatedAt ? `updated ${updatedAt.slice(0, 10)}` : "new"}
              {draft ? ` · ${formatBytes(new Blob([draft]).size)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide">
            <button
              type="button"
              onClick={() => setMode("raw")}
              className={cn("px-2 py-0.5", mode === "raw" ? "border-b-2 border-foreground" : "text-neutral-400")}
            >
              Raw
            </button>
            <button
              type="button"
              onClick={() => setMode("rendered")}
              className={cn(
                "px-2 py-0.5",
                mode === "rendered" ? "border-b-2 border-foreground" : "text-neutral-400",
              )}
            >
              Rendered
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          {mode === "raw" ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-full w-full resize-none bg-white p-4 font-mono text-[12px] leading-relaxed outline-none"
              spellCheck={false}
            />
          ) : (
            <div className="p-6">
              <Markdown>{draft}</Markdown>
            </div>
          )}
        </div>
        {error ? <p className="px-4 py-2 text-[11px] text-rose-600">{error}</p> : null}
        <form
          id="memory-save"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              try {
                await saveMemoryDoc({ path: selectedPath, content: draft });
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "save failed");
              }
            });
          }}
        />
        {pending ? (
          <p className="border-t border-neutral-200 px-4 py-1 text-[10px] text-neutral-400">Saving…</p>
        ) : null}
      </section>
    </div>
  );
}

function groupFiles(files: MemoryFile[]): Array<{ label: string; files: MemoryFile[] }> {
  const root = files
    .filter((f) => !f.path.includes("/"))
    .sort((a, b) => {
      const ia = STANDARD.indexOf(a.path);
      const ib = STANDARD.indexOf(b.path);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.path.localeCompare(b.path);
    });
  const byFolder = new Map<string, MemoryFile[]>();
  for (const f of files) {
    const slash = f.path.indexOf("/");
    if (slash < 0) continue;
    const folder = f.path.slice(0, slash);
    const arr = byFolder.get(folder) ?? [];
    arr.push(f);
    byFolder.set(folder, arr);
  }
  const folderOrder = ["briefings", "insights", "daily", "notes", "recipes", "races", "weekly"];
  const folders = [...byFolder.entries()].sort((a, b) => {
    const ia = folderOrder.indexOf(a[0]);
    const ib = folderOrder.indexOf(b[0]);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a[0].localeCompare(b[0]);
  });
  return [
    { label: "root", files: root },
    ...folders.map(([label, grouped]) => ({
      label,
      files: grouped.sort((a, b) => b.path.localeCompare(a.path)),
    })),
  ];
}
