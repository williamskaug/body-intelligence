"use client";

import { useState, useTransition } from "react";
import { saveWellnessEntry } from "@/app/(app)/data/actions";

type WellnessKey = "fatigue" | "soreness" | "mood" | "stress" | "motivation" | "sleep_quality";

const SCALES: ReadonlyArray<{
  key: WellnessKey;
  label: string;
  // The "5 = best" label for the right-hand end of the scale.
  fiveMeans: string;
  // Direction note for inverted scales.
  invertedNote?: string;
}> = [
  { key: "fatigue", label: "Fatigue", fiveMeans: "no fatigue", invertedNote: "5 = none" },
  { key: "soreness", label: "Soreness", fiveMeans: "no soreness", invertedNote: "5 = none" },
  { key: "mood", label: "Mood", fiveMeans: "great" },
  { key: "stress", label: "Stress", fiveMeans: "no stress", invertedNote: "5 = none" },
  { key: "motivation", label: "Motivation", fiveMeans: "high" },
  { key: "sleep_quality", label: "Sleep quality", fiveMeans: "great" },
];

type Initial = Partial<
  Record<WellnessKey, number | null>
> & {
  sleep_h?: number | string | null;
  hrv_ms?: number | null;
  rhr_bpm?: number | null;
  sleep_notes?: string | null;
  wellness_notes?: string | null;
};

type Props = {
  date: string;
  initial?: Initial;
  title?: string;
  subtitle?: string;
  onSaved?: () => void;
};

export function WellnessForm({ date, initial, title, subtitle, onSaved }: Props) {
  const [values, setValues] = useState<Partial<Record<WellnessKey, number>>>(() => {
    const v: Partial<Record<WellnessKey, number>> = {};
    if (!initial) return v;
    for (const k of SCALES.map((s) => s.key)) {
      const raw = initial[k];
      if (raw != null && Number.isFinite(Number(raw))) v[k] = Number(raw);
    }
    return v;
  });
  const [sleepH, setSleepH] = useState<string>(
    initial?.sleep_h != null ? String(initial.sleep_h) : "",
  );
  const [hrv, setHrv] = useState<string>(initial?.hrv_ms != null ? String(initial.hrv_ms) : "");
  const [rhr, setRhr] = useState<string>(initial?.rhr_bpm != null ? String(initial.rhr_bpm) : "");
  const [sleepNotes, setSleepNotes] = useState<string>(initial?.sleep_notes ?? "");
  const [wellnessNotes, setWellnessNotes] = useState<string>(initial?.wellness_notes ?? "");
  const [showOptional, setShowOptional] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    setError(null);
    const payload: Parameters<typeof saveWellnessEntry>[0] = { date };
    for (const k of SCALES.map((s) => s.key)) {
      const v = values[k];
      if (v != null) payload[k] = v;
    }
    if (sleepH.trim()) {
      const n = Number(sleepH);
      if (Number.isFinite(n) && n >= 0 && n <= 24) payload.sleep_h = n;
    }
    if (hrv.trim()) {
      const n = Number(hrv);
      if (Number.isFinite(n) && n >= 0 && n <= 500) payload.hrv_ms = Math.round(n);
    }
    if (rhr.trim()) {
      const n = Number(rhr);
      if (Number.isFinite(n) && n >= 20 && n <= 200) payload.rhr_bpm = Math.round(n);
    }
    if (sleepNotes.trim()) payload.sleep_notes = sleepNotes;
    if (wellnessNotes.trim()) payload.wellness_notes = wellnessNotes;

    startTransition(async () => {
      try {
        await saveWellnessEntry(payload);
        setSavedAt(Date.now());
        onSaved?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "save failed");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.04] p-5 shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            {title ?? "Daily check-in"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {subtitle ?? "5 = best on every scale. Skip what you can't answer."}
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {date}
        </span>
      </header>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SCALES.map((s) => (
          <ScaleRow
            key={s.key}
            label={s.label}
            fiveMeans={s.fiveMeans}
            invertedNote={s.invertedNote}
            value={values[s.key]}
            onChange={(v) =>
              setValues((prev) => {
                const next = { ...prev };
                if (v == null) delete next[s.key];
                else next[s.key] = v;
                return next;
              })
            }
          />
        ))}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showOptional ? "− Hide" : "+ Add"} sleep / HRV / RHR / notes
        </button>
      </div>

      {showOptional ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <NumberInput label="Sleep" unit="h" value={sleepH} onChange={setSleepH} step="0.1" />
          <NumberInput label="HRV" unit="ms" value={hrv} onChange={setHrv} step="1" />
          <NumberInput label="RHR" unit="bpm" value={rhr} onChange={setRhr} step="1" />
          <TextArea
            className="sm:col-span-3"
            label="Sleep notes"
            placeholder="Qualitative only — woke at 3am, hard time falling asleep, etc."
            value={sleepNotes}
            onChange={setSleepNotes}
          />
          <TextArea
            className="sm:col-span-3"
            label="Wellness notes"
            placeholder="Anything worth flagging — sore knee, stomach off, …"
            value={wellnessNotes}
            onChange={setWellnessNotes}
          />
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-foreground">
          {savedAt
            ? `Saved ${secondsAgo(savedAt)}s ago`
            : "Submitting upserts the row — re-submit to update."}
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-md border border-emerald-500/50 bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-800 hover:bg-emerald-500/25 disabled:opacity-50 dark:text-emerald-300"
        >
          {pending ? "Saving…" : initial ? "Update" : "Log check-in"}
        </button>
      </div>
    </div>
  );
}

function ScaleRow({
  label,
  fiveMeans,
  invertedNote,
  value,
  onChange,
}: {
  label: string;
  fiveMeans: string;
  invertedNote?: string;
  value: number | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        {invertedNote ? (
          <span className="text-[10px] text-amber-700 dark:text-amber-400" title="Inverted scale">
            {invertedNote}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              type="button"
              key={n}
              aria-pressed={active}
              onClick={() => onChange(active ? null : n)}
              className={`h-8 flex-1 rounded-md border text-xs font-medium transition-colors ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground/70 hover:bg-muted"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
        <span>1 = worst</span>
        <span>5 = {fiveMeans}</span>
      </div>
    </div>
  );
}

function NumberInput({
  label,
  unit,
  value,
  onChange,
  step,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">
        {label} <span className="text-[10px]">({unit})</span>
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:border-foreground"
      />
    </label>
  );
}

function TextArea({
  label,
  placeholder,
  value,
  onChange,
  className,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs ${className ?? ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="resize-y rounded-md border bg-background px-2 py-1 text-sm outline-none focus:border-foreground"
      />
    </label>
  );
}

function secondsAgo(ts: number): number {
  return Math.max(0, Math.round((Date.now() - ts) / 1000));
}
