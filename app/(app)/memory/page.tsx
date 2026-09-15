import { MemoryView } from "@/components/memory/memory-view";
import { loadAppSnapshot, loadDocument, requireUser } from "@/lib/app/snapshot";
import { parseWindow } from "@/lib/app/window";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  days?: string;
  focus?: string;
  nogolf?: string;
  path?: string;
}>;

export default async function MemoryPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!user) return null;
  const params = await searchParams;
  const window = parseWindow(params);
  const snapshot = await loadAppSnapshot(user.id, user.email, window);
  const files = snapshot.documents.map((d) => ({ path: d.path, updated_at: d.updated_at }));
  const fallback =
    files.find((f) => f.path === "PRINCIPLES.md")?.path ??
    files.find((f) => f.path === "MEMORY.md")?.path ??
    files[0]?.path ??
    "MEMORY.md";
  const selectedPath = params.path && files.some((f) => f.path === params.path) ? params.path : fallback;
  const cached = snapshot.contentByPath.get(selectedPath);
  const loaded = cached != null ? null : await loadDocument(user.id, selectedPath);
  const content = cached ?? loaded?.content ?? "";
  const updatedAt =
    snapshot.documents.find((d) => d.path === selectedPath)?.updated_at ?? loaded?.updated_at ?? null;

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <MemoryView
        key={selectedPath}
        files={files}
        selectedPath={selectedPath}
        content={content}
        updatedAt={updatedAt}
      />
    </div>
  );
}
