"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { updateProfileAction } from "./actions";

export type ProfileFormProps = {
  defaults: {
    display_name: string;
    timezone: string;
    units_system: "metric" | "imperial";
    locale: string;
  };
  email: string;
};

// Intl.supportedValuesOf is available in modern browsers; fall back to a small
// curated list if the runtime predates it.
function supportedTimezones(): string[] {
  try {
    const fn = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf;
    if (fn) return fn("timeZone");
  } catch {
    // fall through
  }
  return [
    "UTC",
    "Europe/Oslo",
    "Europe/London",
    "Europe/Berlin",
    "America/New_York",
    "America/Los_Angeles",
  ];
}

export function ProfileForm({ defaults }: ProfileFormProps) {
  const [state, action, pending] = useActionState(updateProfileAction, {});
  const [timezone, setTimezone] = useState(defaults.timezone);
  const zones = supportedTimezones();
  const isUtc = timezone === "UTC";

  const detectTimezone = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {
      // ignore — keep current value
    }
  };

  return (
    <form id="profile-form" action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Display name">
        <input
          type="text"
          name="display_name"
          defaultValue={defaults.display_name}
          maxLength={80}
          className="mt-0.5 block w-full border border-neutral-300 px-2 py-1 text-[12px]"
        />
      </Field>

      <Field
        label="Timezone"
        hint="Used for daily-entry date boundaries and the day's readiness gate."
      >
        <div className="flex gap-2">
          <select
            name="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="block w-full border border-neutral-300 px-2 py-1 font-mono text-[12px]"
          >
            {/* Ensure the current value is selectable even if not in the list. */}
            {zones.includes(timezone) ? null : (
              <option value={timezone}>{timezone}</option>
            )}
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={detectTimezone}
            className="shrink-0 rounded-md border bg-background px-2.5 text-xs text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
          >
            Detect
          </button>
        </div>
        {isUtc ? (
          <span className="mt-1 block text-pretty text-[11px] leading-snug text-amber-600 dark:text-amber-400">
            UTC is the default — pick your real zone so day boundaries land correctly.
          </span>
        ) : null}
      </Field>

      <Field label="Units">
        <select
          name="units_system"
          defaultValue={defaults.units_system}
          className="block w-full border border-neutral-300 px-2 py-1 text-[12px]"
        >
          <option value="metric">Metric (kg, km)</option>
          <option value="imperial">Imperial (lb, mi)</option>
        </select>
      </Field>

      <Field label="Locale" hint="e.g. en, en-US, nb-NO.">
        <input
          type="text"
          name="locale"
          defaultValue={defaults.locale}
          placeholder="en"
          autoComplete="off"
          className="block w-full border border-neutral-300 px-2 py-1 font-mono text-[12px]"
        />
      </Field>

      <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-1">
        <p
          className="text-xs"
          aria-live="polite"
        >
          {state.error ? (
            <span className="text-destructive">{state.error}</span>
          ) : state.ok ? (
            <span className="text-muted-foreground">Saved.</span>
          ) : (
            <span className="text-muted-foreground">
              Reasoning recipes also read PROFILE.md — keep it in sync.
            </span>
          )}
        </p>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint ? (
        <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
