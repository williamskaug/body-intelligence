"use client";

import { useState, useTransition } from "react";
import { saveMemoryDoc } from "@/app/(app)/data/actions";

type Props = {
  path: string;
  content: string;
};

export function DocEditor({ path, content }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="border-t bg-muted/20">
        <div className="flex items-center justify-end gap-2 border-b border-dashed px-4 py-2 text-[10px] text-muted-foreground">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setDraft(content);
              setEditing(true);
              setError(null);
            }}
            className="rounded-md border bg-background px-2 py-0.5 font-medium text-foreground/80 hover:text-foreground"
          >
            Edit
          </button>
        </div>
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-b-xl px-4 py-3 font-mono text-xs leading-relaxed">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div className="border-t bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2 text-[10px]">
        <span className="text-muted-foreground">Editing {path}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              setDraft(content);
              setEditing(false);
              setError(null);
            }}
            className="rounded-md border bg-background px-2 py-0.5 font-medium text-foreground/80 hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || draft === content}
            onClick={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                try {
                  await saveMemoryDoc({ path, content: draft });
                  setEditing(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "save failed");
                }
              });
            }}
            className="rounded-md border border-foreground bg-foreground px-2 py-0.5 font-medium text-background disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {error ? (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-700 dark:text-rose-400">
          {error}
        </div>
      ) : null}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        className="block max-h-[60vh] min-h-[16rem] w-full resize-y rounded-b-xl bg-background px-4 py-3 font-mono text-xs leading-relaxed outline-none"
      />
    </div>
  );
}
