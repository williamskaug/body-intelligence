"use client";

import { useTransition } from "react";
import {
  markRecipeInstalled,
  markRecipeUninstalled,
} from "./actions";

export function RecipeInstalledControls({
  recipeId,
  installed,
}: {
  recipeId: string;
  installed: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (installed) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Mark this recipe as uninstalled? (Doesn't remove it from Cowork — just clears BI's local state.)")) {
            return;
          }
          startTransition(async () => {
            await markRecipeUninstalled(recipeId);
          });
        }}
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
      >
        Forget install state
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markRecipeInstalled(recipeId);
        })
      }
      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
    >
      Mark as installed
    </button>
  );
}
