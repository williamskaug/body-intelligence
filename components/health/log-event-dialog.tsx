"use client";

import { useState, useTransition } from "react";
import { saveHealthEvent } from "@/app/(app)/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function LogEventDialog({ todayDate }: { todayDate: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="w-full border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background"
          >
            + Log event
          </button>
        }
      />
      <DialogContent className="max-w-md rounded-none">
        <DialogHeader>
          <DialogTitle>Log health event</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-2 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const sev = Number(fd.get("severity"));
            setError(null);
            start(async () => {
              try {
                await saveHealthEvent({
                  date: String(fd.get("date")),
                  kind: String(fd.get("kind")) as "injury" | "illness" | "symptom",
                  body_part: String(fd.get("body_part") ?? "").trim() || undefined,
                  severity: Number.isFinite(sev) && sev >= 1 ? sev : undefined,
                  notes: String(fd.get("notes") ?? "").trim() || undefined,
                });
                setOpen(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : "save failed");
              }
            });
          }}
        >
          <label>
            Date
            <input name="date" type="date" defaultValue={todayDate} className="mt-0.5 w-full border px-2 py-1" />
          </label>
          <label>
            Kind
            <select name="kind" defaultValue="injury" className="mt-0.5 w-full border px-2 py-1">
              <option value="injury">injury</option>
              <option value="illness">illness</option>
              <option value="symptom">symptom</option>
            </select>
          </label>
          <label>
            Body part
            <input name="body_part" className="mt-0.5 w-full border px-2 py-1" placeholder="left achilles" />
          </label>
          <label>
            Severity 1–5 (5 = most severe)
            <input name="severity" type="number" min={1} max={5} className="mt-0.5 w-full border px-2 py-1" />
          </label>
          <label>
            Notes
            <textarea name="notes" rows={3} className="mt-0.5 w-full border px-2 py-1" />
          </label>
          {error ? <p className="text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="border border-foreground bg-foreground px-3 py-1.5 text-[11px] font-medium text-background disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save event"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
