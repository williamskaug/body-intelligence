import { z } from "zod";
import { datesInRange } from "@/lib/data-display/aggregate";
import { addDaysISO, ewma } from "@/lib/data-display/statistics";
import { dailyImpulseSeries } from "@/lib/data-display/metric-series";
import { round } from "./stats-shared";

// EWMA time constants (TrainingPeaks-style fitness/fatigue/form).
const ATL_TAU_DAYS = 7; // acute load (fatigue)
const CTL_TAU_DAYS = 42; // chronic load (fitness)
const WARMUP_DAYS = 42; // prime the 42-day EWMA before the displayed window
const ATL_ALPHA = 1 - Math.exp(-1 / ATL_TAU_DAYS);
const CTL_ALPHA = 1 - Math.exp(-1 / CTL_TAU_DAYS);

export const getLoadBalanceInputSchema = {
  days: z
    .number()
    .int()
    .min(14)
    .max(365)
    .default(90)
    .describe("Trailing display window. A 42-day warm-up is fetched before it so the CTL EWMA is primed."),
};

export type GetLoadBalanceInput = { days?: number };

export async function getLoadBalance(userId: string, input: GetLoadBalanceInput) {
  const days = input.days ?? 90;
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDisplay = addDaysISO(toDate, -(days - 1));
  const fromWarm = addDaysISO(fromDisplay, -WARMUP_DAYS);

  const impulseMap = await dailyImpulseSeries(userId, fromWarm, toDate);
  const allDates = datesInRange(fromWarm, toDate);
  const ti = allDates.map((d) => impulseMap.get(d) ?? 0); // 0-fill rest days
  // Seed both EWMAs with the mean daily impulse over the warm-up window rather
  // than 0 — a τ=42 EWMA seeded at 0 under-reports fitness (and inflates TSB)
  // for an athlete with under ~5 months of history.
  const warmN = Math.min(WARMUP_DAYS, ti.length);
  const warmMean =
    warmN > 0 ? ti.slice(0, warmN).reduce((a, b) => a + b, 0) / warmN : 0;
  const atl = ewma(ti, ATL_TAU_DAYS, warmMean);
  const ctl = ewma(ti, CTL_TAU_DAYS, warmMean);

  const series: Array<{
    date: string;
    training_impulse: number | null;
    atl: number | null;
    ctl: number | null;
    tsb: number | null;
    acwr: number | null;
  }> = [];
  for (let i = 0; i < allDates.length; i++) {
    const d = allDates[i]!;
    if (d < fromDisplay) continue; // drop warm-up days from the output
    // Form = yesterday's chronic − yesterday's acute (TrainingPeaks TSB).
    const tsb = i > 0 ? ctl[i - 1]! - atl[i - 1]! : ctl[i]! - atl[i]!;
    // Acute:chronic workload ratio — a coupled load ratio (descriptive only).
    const acwr = ctl[i]! > 0 ? round(atl[i]! / ctl[i]!, 2) : null;
    series.push({
      date: d,
      training_impulse: round(ti[i], 1),
      atl: round(atl[i], 1),
      ctl: round(ctl[i], 1),
      tsb: round(tsb, 1),
      acwr,
    });
  }

  const lastIdx = allDates.length - 1;
  const prevIdx = lastIdx - 1;
  const rampIdx = lastIdx - 7;
  const ctlRamp7d = rampIdx >= 0 ? ctl[lastIdx]! - ctl[rampIdx]! : null;
  // Current TSB = yesterday's CTL − ATL, consistent with the series.
  const currentTsb =
    prevIdx >= 0 ? ctl[prevIdx]! - atl[prevIdx]! : ctl[lastIdx]! - atl[lastIdx]!;
  const currentAcwr = ctl[lastIdx]! > 0 ? atl[lastIdx]! / ctl[lastIdx]! : null;
  const daysWithLoad = Array.from(impulseMap.values()).filter((v) => v > 0).length;

  return {
    range: { from: fromDisplay, to: toDate },
    warmup_days: WARMUP_DAYS,
    computed_as_of: toDate,
    constants: {
      atl_tau_days: ATL_TAU_DAYS,
      ctl_tau_days: CTL_TAU_DAYS,
      atl_alpha: round(ATL_ALPHA, 5),
      ctl_alpha: round(CTL_ALPHA, 5),
      ewma_seed: round(warmMean, 1),
      load_formula: "vendor_training_load ?? duration_min*(rpe??5)",
      acwr_reference_band: [0.8, 1.3],
    },
    series,
    current: {
      date: toDate,
      atl: round(atl[lastIdx], 1),
      ctl: round(ctl[lastIdx], 1),
      tsb: round(currentTsb, 1),
      acwr: round(currentAcwr, 2),
      ctl_ramp_7d: round(ctlRamp7d, 1),
    },
    days_with_load: daysWithLoad,
    note: "ATL/CTL are exponentially-weighted moving averages (τ=7d, τ=42d) of daily training impulse; TSB = yesterday's CTL − ATL; acwr = ATL/CTL (the acute:chronic coupled load ratio); ctl_ramp_7d = CTL[today] − CTL[today−7]. The acwr_reference_band (0.8–1.3) is a commonly-cited range, a constant for context only. All deterministic load statistics (the same family as z-score and stdev) — NOT a verdict that you are fresh/fatigued/overtrained and NOT advice to train or rest.",
  };
}
