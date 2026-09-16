import { EmptyNote, Panel, PanelHeader } from "@/components/app/panel";
import { SvgLine } from "@/components/app/charts";
import { MultiSeriesLine } from "@/components/analyze/lazy-charts";
import { formatHours, num } from "@/lib/app/format";
import type { AppSnapshot } from "@/lib/app/snapshot";
import { isRunType } from "@/lib/app/training";
import { KV } from "./analyze-helpers";

export function FormTab({ snapshot }: { snapshot: AppSnapshot }) {
  const runs = snapshot.allWorkouts.filter((w) => isRunType(w.type));
  const gct = runs.map((w) => snapshot.metricsByWorkoutId[w.id]?.gct_ms ?? null);
  const vr = runs.map((w) => num(snapshot.metricsByWorkoutId[w.id]?.vertical_ratio_pct));
  const stride = runs.map((w) => num(snapshot.metricsByWorkoutId[w.id]?.stride_len_m));
  const strength = snapshot.allWorkouts.filter((w) => w.type.toLowerCase().includes("strength"));
  const vol = strength.reduce(
    (a, w) => a + (num(snapshot.metricsByWorkoutId[w.id]?.strength_volume_kg) ?? 0),
    0,
  );
  const open = snapshot.events.filter((e) => !e.resolved_date);

  return (
    <div className="grid gap-px bg-neutral-200">
      <div className="grid gap-px @5xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Cadence" extra="target 170–175" />
          <SvgLine
            points={runs
              .slice()
              .reverse()
              .map((w) => ({
                x: w.date,
                y: num(snapshot.metricsByWorkoutId[w.id]?.cadence_spm),
              }))}
            height={180}
            refs={[
              { y: 170, color: "#a3a3a3", dash: true },
              { y: 175, color: "#a3a3a3", dash: true },
            ]}
          />
        </Panel>
        <Panel>
          <PanelHeader title="Ground contact & vertical ratio" />
          <div className="p-2">
            <MultiSeriesLine
              data={runs
                .slice()
                .reverse()
                .map((w, i) => ({
                  date: w.date,
                  gct: gct[runs.length - 1 - i] ?? null,
                  vr: vr[runs.length - 1 - i] ?? null,
                }))}
              series={[
                { key: "gct", label: "GCT ms", color: "#171717", axis: "left" },
                { key: "vr", label: "VR %", color: "#2563eb", axis: "right" },
              ]}
              minN={4}
            />
          </div>
        </Panel>
      </div>
      <div className="grid gap-px @5xl:grid-cols-3">
        <Panel>
          <PanelHeader title="Cadence vs pace" />
          <EmptyNote>
            {runs.filter((w) => num(snapshot.metricsByWorkoutId[w.id]?.cadence_spm) != null).length} runs
            with cadence in window.
          </EmptyNote>
        </Panel>
        <Panel>
          <PanelHeader title="Stride length" />
          <SvgLine
            points={runs
              .slice()
              .reverse()
              .map((w, i) => ({ x: w.date, y: stride[runs.length - 1 - i] ?? null }))}
            height={140}
          />
        </Panel>
        <Panel>
          <PanelHeader title="Strength & tissue" />
          <dl className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px]">
            <KV
              k="Strength / wk"
              v={`${strength.length} · ${formatHours(strength.reduce((a, w) => a + (w.duration_min ?? 0), 0) / 60)} h`}
            />
            <KV k="Volume" v={vol > 0 ? `${Math.round(vol)} kg` : "—"} />
            <KV k="Open threads" v={open.map((e) => e.body_part ?? e.kind).join(", ") || "none"} />
          </dl>
        </Panel>
      </div>
    </div>
  );
}
