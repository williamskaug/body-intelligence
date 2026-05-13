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

  const isOnboarding = recipe.id === "onboarding";

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm">Install →</Button>} />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{recipe.title}</DialogTitle>
          <DialogDescription>{recipe.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <ol className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1.</span> Open
              Cowork → New scheduled task.
            </li>
            <li className="mt-1">
              <span className="font-medium text-foreground">2.</span> Paste the
              prompt below into the task body.
            </li>
            <li className="mt-1">
              <span className="font-medium text-foreground">3.</span> Paste the
              cron schedule into the schedule field {isOnboarding ? "(or run once, on demand)" : ""}.
            </li>
            <li className="mt-1">
              <span className="font-medium text-foreground">4.</span> Make sure
              the Body Intelligence MCP is enabled for the task.
            </li>
          </ol>

          <section>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {isOnboarding ? "Schedule" : "Cron schedule (UTC)"}
              </p>
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  copy(isOnboarding ? "" : recipe.schedule, "schedule")
                }
              >
                {copied === "schedule" ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="mt-1 rounded-md border bg-muted/30 p-2 font-mono text-xs">
              {isOnboarding ? "On demand — run once" : recipe.schedule}
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

        <DialogFooter className="justify-between text-xs text-muted-foreground sm:justify-between">
          <span>
            Need the MCP URL?{" "}
            <a href="/settings" className="underline underline-offset-4">
              Settings page
            </a>
            .
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
