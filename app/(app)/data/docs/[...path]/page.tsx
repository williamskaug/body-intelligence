import Link from "next/link";
import { notFound } from "next/navigation";
import { DocEditor } from "@/components/data/doc-editor";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DocPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  // Auth is enforced by the parent layout — fetch the user to scope the query
  // (service_role bypasses RLS, so we filter by user_id explicitly).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { path: segments } = await params;
  const path = segments.map((s) => decodeURIComponent(s)).join("/");

  const sb = adminClient();
  const { data, error } = await sb
    .from("documents")
    .select("path, content, updated_at")
    .eq("user_id", user.id)
    .eq("path", path)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) notFound();

  const doc = data as { path: string; content: string; updated_at: string };

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/data"
        className="inline-flex items-center text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        ← Data
      </Link>

      <header className="mt-4">
        <h1 className="font-mono text-xl font-semibold tracking-tight">
          {doc.path}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Updated {formatUpdated(doc.updated_at)}
        </p>
      </header>

      <div className="mt-5 overflow-hidden rounded-xl border bg-card shadow-sm">
        <DocEditor path={doc.path} content={doc.content} />
      </div>
    </div>
  );
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
