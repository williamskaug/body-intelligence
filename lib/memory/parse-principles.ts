// Minimal PRINCIPLES.md parser. v1 ships a keyword-match surfacer; future
// versions could use embeddings or full LLM reasoning.

export type Principle = {
  text: string;
  source: "bullet" | "heading";
};

// Read out bullets and headings as candidate "principles" — the user's writing
// style is what determines what counts. We strip HTML-comment scaffolding
// before parsing so untouched templates yield zero.
export function parsePrinciples(content: string): Principle[] {
  if (!content) return [];
  const stripped = content.replace(/<!--[\s\S]*?-->/g, "");
  const out: Principle[] = [];
  for (const line of stripped.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("##") || trimmed.startsWith("###")) {
      const text = trimmed.replace(/^#+\s*/, "").trim();
      if (text && !looksLikeStub(text)) out.push({ text, source: "heading" });
      continue;
    }
    const m = /^[-*]\s+(.+)$/.exec(trimmed);
    if (m) {
      const text = m[1]!.trim();
      if (text && !looksLikeStub(text)) out.push({ text, source: "bullet" });
    }
  }
  return out;
}

function looksLikeStub(text: string): boolean {
  return text.length < 10 || /^<\s*fill\s+in\b/i.test(text);
}

export type PrincipleCheckContext = {
  yesterdayHighestRpe: number | null;
  hrvBelowBaseline: boolean;
  rhrAboveBaseline: boolean;
  activeHealthEvent: boolean;
};

// Pick the most relevant principle for today given recent data. v1: simple
// keyword overlap.
export function selectRelevantPrinciple(
  principles: ReadonlyArray<Principle>,
  ctx: PrincipleCheckContext,
): { principle: Principle; reason: string } | null {
  if (principles.length === 0) return null;

  const triggers: Array<{ test: () => boolean; tokens: string[]; reason: string }> = [
    {
      test: () => (ctx.yesterdayHighestRpe ?? 0) >= 8,
      tokens: ["hard", "rpe", "easy", "two hard", "back-to-back"],
      reason: `Yesterday was RPE ${ctx.yesterdayHighestRpe}.`,
    },
    {
      test: () => ctx.hrvBelowBaseline,
      tokens: ["hrv", "recover", "rest", "back off"],
      reason: "HRV is below your 30-day baseline.",
    },
    {
      test: () => ctx.rhrAboveBaseline,
      tokens: ["rhr", "resting", "recover", "rest", "illness"],
      reason: "RHR is above your 30-day baseline.",
    },
    {
      test: () => ctx.activeHealthEvent,
      tokens: ["injur", "pain", "niggle", "tweak", "rehab"],
      reason: "There's an active health event open.",
    },
  ];

  for (const trigger of triggers) {
    if (!trigger.test()) continue;
    for (const p of principles) {
      const low = p.text.toLowerCase();
      if (trigger.tokens.some((t) => low.includes(t))) {
        return { principle: p, reason: trigger.reason };
      }
    }
  }
  return null;
}
