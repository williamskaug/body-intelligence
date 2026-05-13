"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-destructive">
        Something broke
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Body Intelligence hit an unexpected error.
      </h1>
      <p className="text-sm text-muted-foreground">
        This is on us. Try again — most errors are transient. If it keeps
        happening, the error reference below helps us track it down.
      </p>
      {error.digest ? (
        <code className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground">
          ref: {error.digest}
        </code>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href="/data"
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          Back to your data
        </Link>
      </div>
    </main>
  );
}
