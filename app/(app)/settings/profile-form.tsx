"use client";

import { useActionState } from "react";
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

export function ProfileForm({ defaults, email }: ProfileFormProps) {
  const [state, action, pending] = useActionState(updateProfileAction, {});

  return (
    <form action={action} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Email" hint="Managed by your magic-link sign-in.">
        <input
          type="email"
          value={email}
          disabled
          className="block w-full rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm text-muted-foreground"
        />
      </Field>

      <Field label="Display name">
        <input
          type="text"
          name="display_name"
          defaultValue={defaults.display_name}
          maxLength={80}
          placeholder="What should we call you?"
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </Field>

      <Field
        label="Timezone"
        hint="IANA name. Used for daily-entry date boundaries."
      >
        <input
          type="text"
          name="timezone"
          defaultValue={defaults.timezone}
          placeholder="Europe/Oslo"
          autoComplete="off"
          className="block w-full rounded-md border bg-background px-3 py-2 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </Field>

      <Field label="Units">
        <select
          name="units_system"
          defaultValue={defaults.units_system}
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
          className="block w-full rounded-md border bg-background px-3 py-2 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint ? (
        <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
