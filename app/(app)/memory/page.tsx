import { MemoryView } from "@/components/memory/memory-view";
import { loadDocument, loadDocumentIndex, requireUser } from "@/lib/app/snapshot";

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
  const files = await loadDocumentIndex(user.id);
  const fallback =
    files.find((f) => f.path === "PRINCIPLES.md")?.path ??
    files.find((f) => f.path === "MEMORY.md")?.path ??
    files[0]?.path ??
    "MEMORY.md";
  const selectedPath = params.path && files.some((f) => f.path === params.path) ? params.path : fallback;
  const loaded = await loadDocument(user.id, selectedPath);
  const content = loaded?.content ?? "";
  const updatedAt =
    files.find((d) => d.path === selectedPath)?.updated_at ?? loaded?.updated_at ?? null;

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
