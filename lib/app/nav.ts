export const APP_NAV = [
  { href: "/today", label: "Today", n: 1 },
  { href: "/train", label: "Train", n: 2 },
  { href: "/analyze", label: "Analyze", n: 3 },
  { href: "/body", label: "Body", n: 4 },
  { href: "/health", label: "Health", n: 5 },
  { href: "/memory", label: "Memory", n: 6 },
  { href: "/agents", label: "Agents", n: 7 },
] as const;

export type AppSection =
  | "today"
  | "train"
  | "analyze"
  | "body"
  | "health"
  | "memory"
  | "agents"
  | "settings";

export function sectionFromPath(pathname: string): AppSection {
  if (pathname.startsWith("/train")) return "train";
  if (pathname.startsWith("/analyze")) return "analyze";
  if (pathname.startsWith("/body")) return "body";
  if (pathname.startsWith("/health")) return "health";
  if (pathname.startsWith("/memory")) return "memory";
  if (pathname.startsWith("/agents")) return "agents";
  if (pathname.startsWith("/settings")) return "settings";
  return "today";
}

export function sectionTitle(section: AppSection): string {
  switch (section) {
    case "today":
      return "Today";
    case "train":
      return "Train";
    case "analyze":
      return "Analyze";
    case "body":
      return "Body";
    case "health":
      return "Health";
    case "memory":
      return "Memory";
    case "agents":
      return "Agents";
    case "settings":
      return "Settings";
  }
}

export function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
