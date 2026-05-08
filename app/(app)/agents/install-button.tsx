"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Recipe } from "@/lib/agents/recipe-data";

export function InstallRecipeButton({ recipe }: { recipe: Recipe }) {
  const [copied, setCopied] = useState<"prompt" | "schedule" | null>(null);

  async function copy(text: string, which: "prompt" | "schedule") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Best-effort; ignore.
    }
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm">Install</Button>} />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{recipe.title}</DialogTitle>
          <DialogDescription>{recipe.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cron schedule (UTC)
              </p>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => copy(recipe.schedule, "schedule")}
              >
                {copied === "schedule" ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="mt-1 rounded-md border bg-muted/30 p-2 font-mono text-xs">
              {recipe.schedule}
            </pre>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Prompt
              </p>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => copy(recipe.prompt, "prompt")}
              >
                {copied === "prompt" ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
              {recipe.prompt}
            </pre>
          </section>

          {recipe.required_connectors.length > 0 ? (
            <p className="rounded-md border border-amber-300/50 bg-amber-100/40 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-100">
              Requires the {recipe.required_connectors.join(", ")} connector to
              be added in Cowork as well — this recipe orchestrates it with the
              BI MCP at conversation time.
            </p>
          ) : null}
        </div>

        <DialogFooter className="text-xs text-muted-foreground">
          Paste these into Cowork&apos;s new-scheduled-task dialog.
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
