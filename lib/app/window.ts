export const WINDOW_DAYS = [7, 30, 90, 365] as const;
export type WindowDays = (typeof WINDOW_DAYS)[number];

export type AppWindow = {
  days: WindowDays;
  focusRun: boolean;
};

export function parseDays(raw: string | undefined, fallback: WindowDays = 90): WindowDays {
  const n = Number(raw);
  if (n === 7 || n === 30 || n === 90 || n === 365) return n;
  return fallback;
}

export function parseFocusRun(raw: string | undefined): boolean {
  return raw === "run" || raw === "1";
}

export function parseWindow(
  params: { days?: string; focus?: string; nogolf?: string },
  fallback: WindowDays = 90,
): AppWindow {
  return {
    days: parseDays(params.days, fallback),
    // `nogolf=1` is the pre-rebuild alias for a training-only filter; treat it
    // as RUN FOCUS so old bookmarks still do something useful.
    focusRun: parseFocusRun(params.focus) || params.nogolf === "1",
  };
}

export function windowQuery(window: AppWindow, extra?: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  p.set("days", String(window.days));
  if (window.focusRun) p.set("focus", "run");
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v != null && v !== "") p.set(k, v);
    }
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function windowLabel(days: number): string {
  return days === 365 ? "1Y" : `${days}D`;
}
