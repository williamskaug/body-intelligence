// Parsing for user-authored recipe documents stored in the virtual
// filesystem under recipes/<slug>.md. An optional YAML front-matter block
// declares display metadata and capability tags:
//
//   ---
//   title: Dawn agent (custom)
//   schedule: 0 9 * * *
//   covers: [ingest:garmin, briefing:daily]
//   ---
//
// covers tags are matched against catalog recipes' covers[] to render
// deterministic "Covered by your <recipe>" badges — tag intersection only,
// no server-side reasoning.

export type UserRecipeDoc = {
  slug: string;
  path: string;
  title: string;
  schedule: string | null;
  covers: string[];
  /** First non-heading prose line of the body, as a short description. */
  description: string | null;
};

export function recipeSlugFromPath(path: string): string | null {
  const m = /^recipes\/([^/]+)\.md$/.exec(path);
  return m ? m[1]! : null;
}

export function parseRecipeDoc(path: string, content: string): UserRecipeDoc | null {
  const slug = recipeSlugFromPath(path);
  if (!slug) return null;

  let title: string | null = null;
  let schedule: string | null = null;
  let covers: string[] = [];
  let body = content;

  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(content);
  if (fm) {
    body = content.slice(fm[0].length);
    for (const line of fm[1]!.split("\n")) {
      const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
      if (!kv) continue;
      const [, key, rawValue] = kv;
      const value = rawValue!.trim();
      if (key === "title") title = stripQuotes(value);
      else if (key === "schedule") schedule = stripQuotes(value);
      else if (key === "covers") covers = parseTagList(value);
    }
  }

  if (!title) {
    const h1 = /^#\s+(.+)$/m.exec(body);
    title = h1 ? h1[1]!.trim() : slug;
  }

  let description: string | null = null;
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("---")) continue;
    description = t.length > 160 ? `${t.slice(0, 157)}…` : t;
    break;
  }

  return { slug, path, title, schedule, covers, description };
}

function parseTagList(value: string): string[] {
  const inner = value.startsWith("[") && value.endsWith("]")
    ? value.slice(1, -1)
    : value;
  return inner
    .split(",")
    .map((s) => stripQuotes(s.trim()))
    .filter((s) => s.length > 0);
}

function stripQuotes(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}
