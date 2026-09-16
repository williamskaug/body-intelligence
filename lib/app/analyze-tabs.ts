export const ANALYZE_TABS = [
  { id: "build", label: "Build" },
  { id: "fitness", label: "Fitness" },
  { id: "long-run", label: "Long run" },
  { id: "intensity", label: "Intensity" },
  { id: "form", label: "Form" },
  { id: "recovery", label: "Recovery" },
  { id: "stats", label: "Stats" },
] as const;

export type AnalyzeTab = (typeof ANALYZE_TABS)[number]["id"];

export function parseAnalyzeTab(raw: string | undefined): AnalyzeTab {
  if (ANALYZE_TABS.some((t) => t.id === raw)) return raw as AnalyzeTab;
  return "build";
}
