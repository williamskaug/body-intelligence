// Anomaly detection over the visible Timeline window.
//
// The point: surface "May 9 RHR was 70 vs baseline 57 ± 4 and HRV was missing"
// as a structured signal users can act on, instead of leaving the day to look
// flat in the calendar. Pure functions — no React, no DB access.

import { computeBaseline, type Baseline } from "./baseline";

export type AnomalyKind =
  | "rhr_high"
  | "hrv_low"
  | "sleep_long"
  | "sleep_short"
  | "missing_hrv"
  | "missing_rhr"
  | "rpe_high_streak";

export type Anomaly = {
  kind: AnomalyKind;
  date: string;
  severity: "low" | "medium" | "high";
  message: string;
  // The math behind the call, for tooltips and recipe reasoning.
  evidence: {
    metric: string;
    value: number | null;
    baseline_mean: number | null;
    baseline_sd: number | null;
  };
};

// 1 SD as the default trigger. Loose enough to catch real signals on a small
// 30-day baseline; tight enough that noise days don't fire constantly.
const SIGMA_TRIGGER = 1.0;

type DayLike = {
  date: string;
  sleep_h: string | null;
  hrv_ms: number | null;
  rhr_bpm: number | null;
};

type WorkoutLike = {
  date: string;
  rpe: number | null;
};

function num(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function severityFromDelta(delta: number, sd: number): "low" | "medium" | "high" {
  const z = sd > 0 ? Math.abs(delta) / sd : 0;
  if (z >= 2) return "high";
  if (z >= 1.5) return "medium";
  return "low";
}

export function detectAnomalies(
  daily: ReadonlyArray<DayLike>,
  workouts: ReadonlyArray<WorkoutLike>,
): Anomaly[] {
  const rhrValues = daily.map((d) => d.rhr_bpm);
  const hrvValues = daily.map((d) => d.hrv_ms);
  const sleepValues = daily.map((d) => num(d.sleep_h));
  const rhrBase = computeBaseline(rhrValues);
  const hrvBase = computeBaseline(hrvValues);
  const sleepBase = computeBaseline(sleepValues);

  const out: Anomaly[] = [];

  for (const d of daily) {
    const rhr = d.rhr_bpm;
    const hrv = d.hrv_ms;
    const sleep = num(d.sleep_h);

    // High RHR vs baseline (elevated resting HR is a recovery/illness flag).
    if (rhr != null && rhrBase) {
      const delta = rhr - rhrBase.mean;
      if (rhrBase.sd > 0 && delta > rhrBase.sd * SIGMA_TRIGGER) {
        out.push({
          kind: "rhr_high",
          date: d.date,
          severity: severityFromDelta(delta, rhrBase.sd),
          message: `RHR ${rhr} vs baseline ${rhrBase.mean.toFixed(0)}±${rhrBase.sd.toFixed(0)}`,
          evidence: {
            metric: "rhr_bpm",
            value: rhr,
            baseline_mean: rhrBase.mean,
            baseline_sd: rhrBase.sd,
          },
        });
      }
    }

    // Suppressed HRV.
    if (hrv != null && hrvBase) {
      const delta = hrv - hrvBase.mean;
      if (hrvBase.sd > 0 && delta < -hrvBase.sd * SIGMA_TRIGGER) {
        out.push({
          kind: "hrv_low",
          date: d.date,
          severity: severityFromDelta(delta, hrvBase.sd),
          message: `HRV ${hrv}ms vs baseline ${hrvBase.mean.toFixed(0)}±${hrvBase.sd.toFixed(0)}`,
          evidence: {
            metric: "hrv_ms",
            value: hrv,
            baseline_mean: hrvBase.mean,
            baseline_sd: hrvBase.sd,
          },
        });
      }
    }

    // Unusually long or short sleep.
    if (sleep != null && sleepBase) {
      const delta = sleep - sleepBase.mean;
      if (sleepBase.sd > 0 && delta > sleepBase.sd * 1.5) {
        out.push({
          kind: "sleep_long",
          date: d.date,
          severity: severityFromDelta(delta, sleepBase.sd),
          message: `Sleep ${sleep.toFixed(1)}h vs baseline ${sleepBase.mean.toFixed(1)}±${sleepBase.sd.toFixed(1)}`,
          evidence: {
            metric: "sleep_h",
            value: sleep,
            baseline_mean: sleepBase.mean,
            baseline_sd: sleepBase.sd,
          },
        });
      } else if (sleepBase.sd > 0 && delta < -sleepBase.sd * 1.5) {
        out.push({
          kind: "sleep_short",
          date: d.date,
          severity: severityFromDelta(delta, sleepBase.sd),
          message: `Sleep ${sleep.toFixed(1)}h vs baseline ${sleepBase.mean.toFixed(1)}±${sleepBase.sd.toFixed(1)}`,
          evidence: {
            metric: "sleep_h",
            value: sleep,
            baseline_mean: sleepBase.mean,
            baseline_sd: sleepBase.sd,
          },
        });
      }
    }

    // Missing-data flags only when the row exists but the field is null —
    // a totally-empty day (no daily entry) is the P1-1 problem, not an
    // anomaly.
    const hasAnyVital = rhr != null || hrv != null || sleep != null;
    if (hasAnyVital && hrv == null) {
      out.push({
        kind: "missing_hrv",
        date: d.date,
        severity: "low",
        message: `HRV not captured — Garmin sync?`,
        evidence: { metric: "hrv_ms", value: null, baseline_mean: null, baseline_sd: null },
      });
    }
    if (hasAnyVital && rhr == null) {
      out.push({
        kind: "missing_rhr",
        date: d.date,
        severity: "low",
        message: `RHR not captured`,
        evidence: { metric: "rhr_bpm", value: null, baseline_mean: null, baseline_sd: null },
      });
    }
  }

  // Three-day RPE high streak.
  const byDate = new Map<string, number>();
  for (const w of workouts) {
    if (w.rpe == null) continue;
    const prev = byDate.get(w.date) ?? 0;
    if (w.rpe > prev) byDate.set(w.date, w.rpe);
  }
  const sortedDates = Array.from(byDate.keys()).sort();
  let streak: string[] = [];
  for (const date of sortedDates) {
    const rpe = byDate.get(date)!;
    if (rpe >= 7) {
      if (streak.length > 0) {
        const prev = new Date(`${streak[streak.length - 1]}T00:00:00Z`);
        const cur = new Date(`${date}T00:00:00Z`);
        const gapDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
        if (gapDays === 1) streak.push(date);
        else streak = [date];
      } else {
        streak = [date];
      }
      if (streak.length >= 3) {
        out.push({
          kind: "rpe_high_streak",
          date,
          severity: "medium",
          message: `${streak.length} hard days in a row (RPE ≥ 7)`,
          evidence: {
            metric: "rpe",
            value: rpe,
            baseline_mean: null,
            baseline_sd: null,
          },
        });
        streak = [];
      }
    } else {
      streak = [];
    }
  }

  return out;
}

export function groupAnomaliesByDate(
  anomalies: ReadonlyArray<Anomaly>,
): Map<string, Anomaly[]> {
  const out = new Map<string, Anomaly[]>();
  for (const a of anomalies) {
    const arr = out.get(a.date);
    if (arr) arr.push(a);
    else out.set(a.date, [a]);
  }
  return out;
}

// Helper for the "What's worth your attention" panel: pick the top N anomalies
// ranked by (severity, recency).
export function topAnomalies(
  anomalies: ReadonlyArray<Anomaly>,
  n = 5,
): Anomaly[] {
  const score = (a: Anomaly): number => {
    const sev = a.severity === "high" ? 3 : a.severity === "medium" ? 2 : 1;
    // Newer dates come first; date string lex sort works for ISO.
    return sev * 10_000 + new Date(a.date).getTime() / 86_400_000;
  };
  return [...anomalies].sort((a, b) => score(b) - score(a)).slice(0, n);
}

export type { Baseline };
