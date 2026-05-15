// Helpers for distinguishing seed-template content from user-authored content
// in the memory documents grid.
//
// The seeded templates ship with markdown structure, headings, and HTML-comment
// fill-in prompts ("<!-- ... -->" and "<fill in>"). A naive token count over the
// whole file makes an untouched template look "filled in" (~100-250 words).
// `meaningfulWordCount` strips that scaffolding and returns the count of words
// the user actually wrote.

const PLACEHOLDER_PATTERNS: RegExp[] = [
  // HTML comments — both single-line and multi-line.
  /<!--[\s\S]*?-->/g,
  // Inline <fill in>-style stub markers.
  /<\s*fill\s+in[^>]*>/gi,
  // Bracketed placeholder hints like [optional] or [paste here]
  /\[(?:optional|paste here|fill in|tbd)\]/gi,
];

export function stripScaffolding(content: string): string {
  let out = content;
  for (const re of PLACEHOLDER_PATTERNS) {
    out = out.replace(re, "");
  }
  // Strip markdown bullet markers and heading prefixes that are part of the
  // template's structure but have no user content on the same line.
  out = out
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      // Lines that are JUST a bullet/heading prefix and an empty body —
      // e.g. "- 5k:" with nothing after the colon — are template stubs.
      if (/^(?:#+|[-*])\s*[A-Za-z][^:]*:\s*$/.test(trimmed)) return "";
      return line;
    })
    .join("\n");
  return out;
}

export function meaningfulWordCount(content: string): number {
  const stripped = stripScaffolding(content);
  const m = stripped.trim().match(/\S+/g);
  return m ? m.length : 0;
}

// A coarse "looks like nothing was written" check. Used to badge cards that
// still resemble the seed template even after our own template files have
// drifted (so direct equality against the current template fails for users
// who signed up before that drift).
export function looksLikeTemplate(content: string): boolean {
  // Lots of structural markers + very few meaningful words is the tell.
  const hasPlaceholder = PLACEHOLDER_PATTERNS.some((re) => re.test(content));
  return hasPlaceholder && meaningfulWordCount(content) < 25;
}
