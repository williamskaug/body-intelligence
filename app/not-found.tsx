import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
        404 · Not found
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        That page isn&apos;t here.
      </h1>
      <p className="text-sm text-muted-foreground">
        The link is broken, the page moved, or it never existed. Head back to
        your data or the recipe library.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/data" className={buttonVariants({ size: "lg" })}>
          Open your data
        </Link>
        <Link
          href="/"
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          Marketing site
        </Link>
      </div>
    </main>
  );
}
