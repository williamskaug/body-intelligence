"use client";

import { useState, useTransition } from "react";
import { saveWorkout } from "@/app/(app)/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddWorkoutDialog({ todayDate }: { todayDate: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background"
          >
            + Add workout
          </button>
        }
      />
      <DialogContent className="max-w-md rounded-none">
        <DialogHeader>
          <DialogTitle>Add workout</DialogTitle>
        </DialogHeader>
        <form
          className="grid grid-cols-2 gap-2 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const duration = Number(fd.get("duration_min"));
            const distance = Number(fd.get("distance_km"));
            const avgHr = Number(fd.get("avg_hr"));
            const rpe = Number(fd.get("rpe"));
            setError(null);
            start(async () => {
              try {
                await saveWorkout({
                  date: String(fd.get("date")),
                  type: String(fd.get("type")),
                  duration_min: Number.isFinite(duration) && duration > 0 ? duration : undefined,
                  distance_km: Number.isFinite(distance) && distance > 0 ? distance : undefined,
                  avg_hr: Number.isFinite(avgHr) && avgHr > 0 ? avgHr : undefined,
                  rpe: Number.isFinite(rpe) && rpe > 0 ? rpe : undefined,
                  notes: String(fd.get("notes") ?? "") || undefined,
                });
                setOpen(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : "save failed");
              }
            });
          }}
        >
          <label className="col-span-1">
            Date
            <input name="date" type="date" defaultValue={todayDate} className="mt-0.5 w-full border px-2 py-1" />
          </label>
          <label className="col-span-1">
            Type
            <select name="type" defaultValue="run" className="mt-0.5 w-full border px-2 py-1">
              {["run", "ride", "strength", "walk", "golf", "swim", "yoga", "mobility"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Duration (min)
            <input name="duration_min" type="number" className="mt-0.5 w-full border px-2 py-1" />
          </label>
          <label>
            Distance (km)
            <input name="distance_km" type="number" step="0.1" className="mt-0.5 w-full border px-2 py-1" />
          </label>
          <label>
            Avg HR
            <input name="avg_hr" type="number" className="mt-0.5 w-full border px-2 py-1" />
          </label>
          <label>
            RPE
            <input name="rpe" type="number" min={1} max={10} className="mt-0.5 w-full border px-2 py-1" />
          </label>
          <label className="col-span-2">
            Notes / title
            <input name="notes" className="mt-0.5 w-full border px-2 py-1" />
          </label>
          {error ? <p className="col-span-2 text-rose-700">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="col-span-2 border border-foreground bg-foreground py-1.5 text-background disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save workout"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
