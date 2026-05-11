import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ days?: string }>;

type Workout = {
  id: string;
  date: string;
  type: string;
  duration_min: number | null;
  distance_km: string | null;
  avg_hr: number | null;
  max_hr: number | null;
  rpe: number | null;
  shoes: string | null;
  source: string;
  notes: string | null;
};

type DailyEntry = {
  id: string;
  date: string;
  sleep_h: string | null;
  hrv_ms: number | null;
  rhr_bpm: number | null;
  weight_kg: string | null;
  fatigue: number | null;
  soreness: number | null;
  mood: number | null;
  stress: number | null;
  motivation: number | null;
  sleep_quality: number | null;
  sleep_notes: string | null;
  wellness_notes: string | null;
  meal_notes: string | null;
};

type Meal = {
  id: string;
  eaten_at: string;
  meal_type: string | null;
  description: string;
  calories: number | null;
  protein_g: string | null;
  carbs_g: string | null;
  fat_g: string | null;
  source: string;
};

type HealthEvent = {
  id: string;
  date: string;
  kind: string;
  body_part: string | null;
  severity: number | null;
  notes: string | null;
  resolved_date: string | null;
};

type Document = {
  path: string;
  content: string;
  updated_at: string;
};

export default async function DataPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fdata");

  const params = await searchParams;
  const days = parseDays(params.days);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceDate = since.toISOString().slice(0, 10);
  const sinceIso = since.toISOString();

  const sb = adminClient();

  const [workouts, daily, meals, healthRecent, healthOpenOlder, documents] =
    await Promise.all([
      sb
        .from("workouts")
        .select(
          "id, date, type, duration_min, distance_km, avg_hr, max_hr, rpe, shoes, source, notes",
        )
        .eq("user_id", user.id)
        .gte("date", sinceDate)
        .order("date", { ascending: false }),
      sb
        .from("daily_entries")
        .select(
          "id, date, sleep_h, hrv_ms, rhr_bpm, weight_kg, fatigue, soreness, mood, stress, motivation, sleep_quality, sleep_notes, wellness_notes, meal_notes",
        )
        .eq("user_id", user.id)
        .gte("date", sinceDate)
        .order("date", { ascending: false }),
      sb
        .from("meals")
        .select(
          "id, eaten_at, meal_type, description, calories, protein_g, carbs_g, fat_g, source",
        )
        .eq("user_id", user.id)
        .gte("eaten_at", sinceIso)
        .order("eaten_at", { ascending: false }),
      sb
        .from("health_events")
        .select("id, date, kind, body_part, severity, notes, resolved_date")
        .eq("user_id", user.id)
        .gte("date", sinceDate)
        .order("date", { ascending: false }),
      sb
        .from("health_events")
        .select("id, date, kind, body_part, severity, notes, resolved_date")
        .eq("user_id", user.id)
        .lt("date", sinceDate)
        .is("resolved_date", null)
        .order("date", { ascending: false }),
      sb
        .from("documents")
        .select("path, content, updated_at")
        .eq("user_id", user.id)
        .order("path", { ascending: true }),
    ]);

  for (const r of [workouts, daily, meals, healthRecent, healthOpenOlder, documents]) {
    if (r.error) throw new Error(r.error.message);
  }

  const events = mergeHealthEvents(
    (healthRecent.data ?? []) as HealthEvent[],
    (healthOpenOlder.data ?? []) as HealthEvent[],
  );

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Your data</h1>
        <p className="text-sm text-muted-foreground">
          Last {days} {days === 1 ? "day" : "days"} ·{" "}
          <WindowLink days={7} active={days === 7} />
          {" · "}
          <WindowLink days={30} active={days === 30} />
          {" · "}
          <WindowLink days={90} active={days === 90} />
          {" · "}
          <WindowLink days={365} active={days === 365} />
        </p>
      </header>

      <Section
        title="Workouts"
        count={(workouts.data ?? []).length}
        empty="No workouts in this window."
      >
        <WorkoutsTable rows={(workouts.data ?? []) as Workout[]} />
      </Section>

      <Section
        title="Daily entries"
        count={(daily.data ?? []).length}
        empty="No daily entries in this window."
      >
        <DailyTable rows={(daily.data ?? []) as DailyEntry[]} />
      </Section>

      <Section
        title="Meals"
        count={(meals.data ?? []).length}
        empty="No meals in this window."
      >
        <MealsTable rows={(meals.data ?? []) as Meal[]} />
      </Section>

      <Section
        title="Health events"
        count={events.length}
        empty="No health events. Anything unresolved older than the window would still show up here."
      >
        <HealthEventsList rows={events} sinceDate={sinceDate} />
      </Section>

      <Section
        title="Memory documents"
        count={(documents.data ?? []).length}
        empty="No documents yet — these are normally seeded on signup."
      >
        <DocumentsList rows={(documents.data ?? []) as Document[]} />
      </Section>
    </div>
  );
}

function parseDays(raw: string | undefined): number {
  const n = Number(raw ?? "30");
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(365, Math.floor(n)));
}

function mergeHealthEvents(recent: HealthEvent[], openOlder: HealthEvent[]): HealthEvent[] {
  const seen = new Set<string>();
  const merged: HealthEvent[] = [];
  for (const row of [...recent, ...openOlder]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

function WindowLink({ days, active }: { days: number; active: boolean }) {
  if (active) {
    return <span className="font-medium text-foreground">{days}d</span>;
  }
  return (
    <Link href={`?days=${days}`} className="underline hover:text-foreground">
      {days}d
    </Link>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <Badge variant="outline">{count}</Badge>
      </div>
      {count === 0 ? (
        <div className="border-t px-6 py-6 text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div className="border-t">{children}</div>
      )}
    </section>
  );
}

function WorkoutsTable({ rows }: { rows: Workout[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted-foreground">
            <Th>Date</Th>
            <Th>Type</Th>
            <Th align="right">Min</Th>
            <Th align="right">Km</Th>
            <Th align="right">Avg HR</Th>
            <Th align="right">Max HR</Th>
            <Th align="right">RPE</Th>
            <Th>Source</Th>
            <Th>Notes</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} className="text-sm">
              <Td mono>{r.date}</Td>
              <Td>{r.type}</Td>
              <Td align="right">{r.duration_min ?? "—"}</Td>
              <Td align="right">{r.distance_km ?? "—"}</Td>
              <Td align="right">{r.avg_hr ?? "—"}</Td>
              <Td align="right">{r.max_hr ?? "—"}</Td>
              <Td align="right">{r.rpe ?? "—"}</Td>
              <Td mono>{r.source}</Td>
              <Td truncate>{r.notes ?? ""}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyTable({ rows }: { rows: DailyEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted-foreground">
            <Th>Date</Th>
            <Th align="right">Sleep h</Th>
            <Th align="right">HRV</Th>
            <Th align="right">RHR</Th>
            <Th align="right">Kg</Th>
            <Th align="right" title="Fatigue (5 = freshest)">Ftg</Th>
            <Th align="right" title="Soreness (5 = least sore)">Sor</Th>
            <Th align="right" title="Mood (5 = best)">Mood</Th>
            <Th align="right" title="Stress (5 = least stressed)">Strs</Th>
            <Th align="right" title="Motivation (5 = highest)">Mtv</Th>
            <Th align="right" title="Sleep quality (5 = best)">SlQ</Th>
            <Th>Notes</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} className="text-sm">
              <Td mono>{r.date}</Td>
              <Td align="right">{r.sleep_h ?? "—"}</Td>
              <Td align="right">{r.hrv_ms ?? "—"}</Td>
              <Td align="right">{r.rhr_bpm ?? "—"}</Td>
              <Td align="right">{r.weight_kg ?? "—"}</Td>
              <Td align="right">{r.fatigue ?? "—"}</Td>
              <Td align="right">{r.soreness ?? "—"}</Td>
              <Td align="right">{r.mood ?? "—"}</Td>
              <Td align="right">{r.stress ?? "—"}</Td>
              <Td align="right">{r.motivation ?? "—"}</Td>
              <Td align="right">{r.sleep_quality ?? "—"}</Td>
              <Td truncate>{[r.sleep_notes, r.wellness_notes, r.meal_notes].filter(Boolean).join(" · ")}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MealsTable({ rows }: { rows: Meal[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted-foreground">
            <Th>Eaten at</Th>
            <Th>Type</Th>
            <Th>Description</Th>
            <Th align="right">Cal</Th>
            <Th align="right">P</Th>
            <Th align="right">C</Th>
            <Th align="right">F</Th>
            <Th>Source</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} className="text-sm">
              <Td mono>{formatTimestamp(r.eaten_at)}</Td>
              <Td>{r.meal_type ?? "—"}</Td>
              <Td truncate>{r.description}</Td>
              <Td align="right">{r.calories ?? "—"}</Td>
              <Td align="right">{r.protein_g ?? "—"}</Td>
              <Td align="right">{r.carbs_g ?? "—"}</Td>
              <Td align="right">{r.fat_g ?? "—"}</Td>
              <Td mono>{r.source}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HealthEventsList({
  rows,
  sinceDate,
}: {
  rows: HealthEvent[];
  sinceDate: string;
}) {
  return (
    <ul className="divide-y">
      {rows.map((r) => {
        const olderThanWindow = r.date < sinceDate;
        return (
          <li key={r.id} className="flex items-start gap-3 px-6 py-4 text-sm">
            <div className="flex flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{r.date}</span>
                <Badge variant={r.resolved_date ? "secondary" : "default"}>
                  {r.kind}
                </Badge>
                {r.body_part ? (
                  <span className="text-muted-foreground">· {r.body_part}</span>
                ) : null}
                {r.severity ? (
                  <span className="text-muted-foreground">
                    · severity {r.severity}/5
                  </span>
                ) : null}
                {r.resolved_date ? (
                  <Badge variant="outline">resolved {r.resolved_date}</Badge>
                ) : olderThanWindow ? (
                  <Badge variant="outline">unresolved · outside window</Badge>
                ) : null}
              </div>
              {r.notes ? (
                <p className="mt-1 text-muted-foreground">{r.notes}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DocumentsList({ rows }: { rows: Document[] }) {
  return (
    <ul className="divide-y">
      {rows.map((doc) => (
        <li key={doc.path} className="px-6 py-3">
          <details>
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span className="font-mono">{doc.path}</span>
              <span className="text-xs text-muted-foreground">
                {timeAgo(doc.updated_at)}
              </span>
            </summary>
            <pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
              {doc.content}
            </pre>
          </details>
        </li>
      ))}
    </ul>
  );
}

function Th({
  children,
  align = "left",
  title,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  title?: string;
}) {
  return (
    <th
      title={title}
      className={`px-4 py-2 font-medium ${
        align === "right" ? "text-right tabular-nums" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono,
  truncate,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <td
      className={`px-4 py-2 ${align === "right" ? "text-right tabular-nums" : "text-left"} ${
        mono ? "font-mono text-xs" : ""
      } ${truncate ? "max-w-[16rem] truncate" : ""}`}
      title={truncate && typeof children === "string" ? children : undefined}
    >
      {children}
    </td>
  );
}

function formatTimestamp(iso: string): string {
  // Display in a compact, human-readable shape; we leave timezone alone here
  // because everything in the DB is already timestamptz-correct.
  const d = new Date(iso);
  const ymd = d.toISOString().slice(0, 10);
  const hm = d.toISOString().slice(11, 16);
  return `${ymd} ${hm}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}
