import Link from "next/link";
import { looksLikeTemplate } from "@/lib/memory/template-detection";
import {
  parsePrinciples,
  selectRelevantPrinciple,
  type PrincipleCheckContext,
} from "@/lib/memory/parse-principles";

type Props = {
  principlesContent: string;
  ctx: PrincipleCheckContext;
};

export function PrincipleCheck({ principlesContent, ctx }: Props) {
  if (!principlesContent || looksLikeTemplate(principlesContent)) {
    return (
      <section className="rounded-2xl border border-dashed bg-muted/10 px-5 py-4 text-sm shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Today vs your principles
        </h2>
        <p className="mt-1 text-muted-foreground">
          PRINCIPLES.md is still a template — once you write your training rules,
          Claude reasons against them and BI quotes the relevant one here.
        </p>
        <Link
          href="/agents?id=onboarding"
          className="mt-2 inline-flex text-xs font-medium underline-offset-2 hover:underline"
        >
          Run onboarding →
        </Link>
      </section>
    );
  }

  const principles = parsePrinciples(principlesContent);
  const pick = selectRelevantPrinciple(principles, ctx);

  if (!pick) {
    return (
      <section className="rounded-2xl border bg-card/60 px-5 py-3 text-sm shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Today vs your principles
        </h2>
        <p className="mt-1 text-muted-foreground">
          Nothing in today&apos;s data triggers one of your principles.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.05] px-5 py-4 text-sm shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
        Today vs your principles
      </h2>
      <p className="mt-2 italic text-foreground/90">“{pick.principle.text}”</p>
      <p className="mt-1 text-xs text-muted-foreground">{pick.reason}</p>
    </section>
  );
}
