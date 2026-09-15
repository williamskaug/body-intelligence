"use client";

import { useMemo, useState, useTransition } from "react";
import { saveWellnessEntry } from "@/app/(app)/actions";
import { Panel, PanelHeader } from "@/components/app/panel";
import { Sparkline } from "@/components/data/sparkline";
import { computeBaseline } from "@/lib/data-display/baseline";
import { num } from "@/lib/app/format";
import type { AppSnapshot, DailyRow } from "@/lib/app/snapshot";
import { cn } from "@/lib/utils";

type MetricId =
  | "hrv"
  | "rhr"
  | "sleep"
  | "sleep_score"
  | "battery"
  | "stress"
  | "weight"
  | "steps"
  | "vo2";

type Tile = {
  id: MetricId;
  label: string;
  unit: string;
  value: number | null;
  series: Array<number | null>;
  baseline: ReturnType<typeof computeBaseline>;
  higherIsBetter: boolean | null;
};

function zOf(value: number | null, base: ReturnType<typeof computeBaseline>): number | null {
  if (value == null || !base || base.sd <= 0) return null;
  return (value - base.mean) / base.sd;
}

function fmtZ(z: number | null): string {
  if (z == null) return "";
  const sign = z > 0 ? "+" : z < 0 ? "−" : "";
  return `z ${sign}${Math.abs(z).toFixed(2)}`;
}

export function BodyView({ snapshot }: { snapshot: AppSnapshot }) {
  const [selected, setSelected] = useState<MetricId>("hrv");
  const daily = snapshot.dailyHistory;
  const chrono = useMemo(() => [...daily].reverse(), [daily]);
  const latest = daily[0] ?? null;
  const vo2Series = snapshot.capacity.map((c) => num(c.vo2max_running));
  const latestVo2 = [...snapshot.capacity].reverse().find((c) => num(c.vo2max_running) != null);

  const tiles: Tile[] = useMemo(() => {
    const seriesOf = (pick: (d: DailyRow) => number | null) => chrono.map(pick);
    const hrv = seriesOf((d) => d.hrv_ms);
    const rhr = seriesOf((d) => d.rhr_bpm);
    const sleep = seriesOf((d) => num(d.sleep_h));
    const score = seriesOf((d) => d.sleep_score);
    const battery = seriesOf((d) => d.body_battery_morning);
    const stress = seriesOf((d) => d.stress_score);
    const weight = seriesOf((d) => num(d.weight_kg));
    const steps = seriesOf((d) => d.steps);
    const mk = (
      id: MetricId,
      label: string,
      unit: string,
      value: number | null,
      series: Array<number | null>,
      higherIsBetter: boolean | null,
    ): Tile => ({
      id,
      label,
      unit,
      value,
      series,
      baseline: computeBaseline(series.slice(-60)),
      higherIsBetter,
    });
    return [
      mk("hrv", "HRV", "ms", latest?.hrv_ms ?? null, hrv, true),
      mk("rhr", "RHR", "bpm", latest?.rhr_bpm ?? null, rhr, false),
      mk("sleep", "Sleep", "h", num(latest?.sleep_h), sleep, true),
      mk("sleep_score", "Sleep score", "", latest?.sleep_score ?? null, score, true),
      mk("battery", "Body battery", "", latest?.body_battery_morning ?? null, battery, true),
      mk("stress", "Stress", "", latest?.stress_score ?? null, stress, false),
      mk("weight", "Weight", "kg", num(latest?.weight_kg), weight, null),
      mk("steps", "Steps", "", latest?.steps ?? null, steps, null),
      mk(
        "vo2",
        "VO₂max",
        "",
        num(latestVo2?.vo2max_running ?? null),
        vo2Series,
        true,
      ),
    ];
  }, [chrono, latest, latestVo2, vo2Series]);

  const active = tiles.find((t) => t.id === selected) ?? tiles[0]!;

  return (
    <div className="grid gap-px bg-neutral-200 lg:grid-cols-[1.4fr_0.7fr]">
      <div>
        <div className="grid grid-cols-3 gap-px bg-neutral-200">
          {tiles.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              className={cn(
                "bg-white px-3 py-2.5 text-left hover:bg-neutral-50",
                selected === t.id && "ring-1 ring-inset ring-foreground",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="bi-label">{t.label}</span>
                <span className="font-mono text-[10px] text-neutral-400">{fmtZ(zOf(t.value, t.baseline))}</span>
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div>
                  <span className="font-mono text-xl tabular-nums leading-none">
                    {t.value == null ? "—" : t.id === "steps" ? t.value.toLocaleString() : t.value.toFixed(t.id === "sleep" || t.id === "weight" || t.id === "vo2" ? 1 : 0)}
                  </span>
                  {t.unit ? (
                    <span className="ml-1 text-[11px] text-neutral-500">{t.unit}</span>
                  ) : null}
                </div>
                <Sparkline values={t.series.slice(-60)} width={88} height={28} baseline={t.baseline} />
              </div>
              {t.baseline ? (
                <div className="mt-1 font-mono text-[10px] text-neutral-400">
                  base {t.baseline.mean.toFixed(t.id === "sleep" || t.id === "weight" ? 1 : 0)} ±{" "}
                  {t.baseline.sd.toFixed(t.id === "sleep" || t.id === "weight" ? 1 : 0)} · {t.baseline.count} d
                </div>
              ) : null}
            </button>
          ))}
        </div>
        <Panel>
          <PanelHeader
            title={active.label}
            extra={`${active.series.filter((v) => v != null).length} d`}
          />
          <div className="px-3 py-3">
            <Sparkline
              values={active.series}
              width={640}
              height={180}
              baseline={active.baseline}
              stroke="#171717"
            />
          </div>
        </Panel>
      </div>
      <CheckInForm date={snapshot.todayDate} latest={latest} />
    </div>
  );
}

function CheckInForm({
  date,
  latest,
}: {
  date: string;
  latest: DailyRow | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <Panel id="check-in">
      <PanelHeader title={`Check-in ${date}`} extra="vitals + notes" />
      <form
        id="check-in-form"
        className="grid gap-2 px-3 py-3 text-[12px]"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const n = (key: string) => {
            const v = String(fd.get(key) ?? "").trim();
            if (!v) return undefined;
            const x = Number(v);
            return Number.isFinite(x) ? x : undefined;
          };
          setError(null);
          start(async () => {
            try {
              await saveWellnessEntry({
                date,
                sleep_h: n("sleep_h"),
                hrv_ms: n("hrv_ms") != null ? Math.round(n("hrv_ms")!) : undefined,
                rhr_bpm: n("rhr_bpm") != null ? Math.round(n("rhr_bpm")!) : undefined,
                weight_kg: n("weight_kg"),
                sleep_notes: String(fd.get("sleep_notes") ?? "").trim() || undefined,
                wellness_notes: String(fd.get("wellness_notes") ?? "").trim() || undefined,
              });
              setSaved(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : "save failed");
            }
          });
        }}
      >
        <p className="text-[11px] text-neutral-500">
          Wearable vitals plus free-text notes. Subjective 1–5 scales are not captured — those
          columns were dropped. Skip anything you don&apos;t have.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Sleep h" name="sleep_h" defaultValue={latest?.sleep_h ?? ""} step="0.1" />
          <Field label="HRV ms" name="hrv_ms" defaultValue={latest?.hrv_ms ?? ""} />
          <Field label="RHR" name="rhr_bpm" defaultValue={latest?.rhr_bpm ?? ""} />
        </div>
        <Field label="Weight kg" name="weight_kg" defaultValue={latest?.weight_kg ?? ""} step="0.1" />
        <label className="block">
          Sleep notes
          <textarea
            name="sleep_notes"
            defaultValue={latest?.sleep_notes ?? ""}
            rows={2}
            className="mt-0.5 w-full border border-neutral-300 px-2 py-1 text-[12px]"
          />
        </label>
        <label className="block">
          Notes
          <textarea
            name="wellness_notes"
            defaultValue={latest?.wellness_notes ?? ""}
            rows={4}
            placeholder="Legs, sleep, anything Claude should know"
            className="mt-0.5 w-full border border-neutral-300 px-2 py-1 text-[12px]"
          />
        </label>
        {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
        {saved ? <p className="text-[11px] text-emerald-700">Saved.</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="border border-foreground bg-foreground px-3 py-1.5 text-[11px] font-medium text-background disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save check-in"}
        </button>
      </form>
    </Panel>
  );
}

function Field({
  label,
  name,
  defaultValue,
  step,
}: {
  label: string;
  name: string;
  defaultValue: string | number | null;
  step?: string;
}) {
  return (
    <label className="block">
      {label}
      <input
        name={name}
        type="number"
        step={step ?? "1"}
        defaultValue={defaultValue ?? ""}
        className="mt-0.5 w-full border border-neutral-300 px-2 py-1 font-mono text-[12px]"
      />
    </label>
  );
}
