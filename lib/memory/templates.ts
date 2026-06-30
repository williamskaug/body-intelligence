import fs from "node:fs";
import path from "node:path";

export const TEMPLATE_PATHS = [
  "MEMORY.md",
  "PROFILE.md",
  "PRINCIPLES.md",
  "GOALS.md",
  "CURRENT.md",
  "HEALTH_LOG.md",
  "NUTRITION.md",
  "EQUIPMENT.md",
  "THRESHOLDS.md",
  "RECORDS.md",
] as const;

export type TemplatePath = (typeof TEMPLATE_PATHS)[number];

let cache: Record<TemplatePath, string> | null = null;

export function loadTemplates(): Record<TemplatePath, string> {
  if (cache) return cache;
  const dir = path.join(process.cwd(), "lib", "memory", "templates");
  const entries = TEMPLATE_PATHS.map(
    (p) => [p, fs.readFileSync(path.join(dir, p), "utf-8")] as const,
  );
  cache = Object.fromEntries(entries) as Record<TemplatePath, string>;
  return cache;
}
