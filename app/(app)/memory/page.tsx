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
  const filesPromise = loadDocumentIndex(user.id);
  const hintedPath = params.path;
  const hintedDocPromise = hintedPath ? loadDocument(user.id, hintedPath) : Promise.resolve(null);
  const [files, hinted] = await Promise.all([filesPromise, hintedDocPromise]);
  const fallback =
    files.find((f) => f.path === "PRINCIPLES.md")?.path ??
    files.find((f) => f.path === "MEMORY.md")?.path ??
    files[0]?.path ??
    "MEMORY.md";
  const selectedPath = hintedPath && files.some((f) => f.path === hintedPath) ? hintedPath : fallback;
  const loaded =
    selectedPath === hintedPath && hinted
      ? hinted
      : selectedPath !== hintedPath
        ? await loadDocument(user.id, selectedPath)
        : hinted;
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
