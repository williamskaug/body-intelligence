/**
 * One-shot backfill: parse sleep-stage minutes and Body Battery numbers out
 * of daily_entries.sleep_notes prose, write them to their structured columns
 * (sleep_*_min) and to daily/YYYY-MM-DD.md (Body Battery), then strip the
 * extracted substrings from sleep_notes so it goes back to being prose.
 *
 * Run with:
 *   pnpm dlx tsx --env-file=.env.local scripts/backfill-sleep-stages.ts --dry
 *   pnpm dlx tsx --env-file=.env.local scripts/backfill-sleep-stages.ts
 *
 * --dry  Show what would change without writing.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const isDry = process.argv.includes("--dry");

type DailyRow = {
  id: string;
  user_id: string;
  date: string;
  sleep_h: string | null;
  sleep_deep_min: number | null;
  sleep_light_min: number | null;
  sleep_rem_min: number | null;
  sleep_awake_min: number | null;
  sleep_notes: string | null;
};

// "1h35m deep", "4h33m light", "1h40m REM", "1 awake" / "32m awake"
function parseStage(prose: string, label: string): number | null {
  const hm = new RegExp(`(\\d+)\\s*h\\s*(\\d+)\\s*m\\s+${label}`, "i").exec(prose);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const mOnly = new RegExp(`(\\d+)\\s*m\\s+${label}`, "i").exec(prose);
  if (mOnly) return Number(mOnly[1]);
  const wholeAwakeCount = new RegExp(`(\\d+)\\s+${label}\\b`, "i").exec(prose);
  if (label === "awake" && wholeAwakeCount) {
    // "1 awake" probably means 1 wake event, not 1 minute. Don't backfill —
    // log so the user can inspect.
    return null;
  }
  return wholeAwakeCount ? Number(wholeAwakeCount[1]) : null;
}

// "Body battery +61" / "Body battery: +61" / "Battery 56"
function parseBodyBatteryCharge(prose: string): number | null {
  const m = /body\s*batter(?:y|ies)?\s*[:=]?\s*\+?(-?\d+)/i.exec(prose);
  return m ? Number(m[1]) : null;
}

function stripBodyBattery(prose: string): string {
  return prose
    .replace(/body\s*batter(?:y|ies)?\s*[:=]?\s*\+?-?\d+\s*\(?[^)]*\)?\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripSleepStages(prose: string): string {
  return prose
    .replace(/\d+\s*h\s*\d+\s*m\s+(deep|light|rem)\b[^.,]*[.,]?/gi, "")
    .replace(/\d+\s*m\s+awake\b[^.,]*[.,]?/gi, "")
    .replace(/(?:garmin\s+)?sleep\s+score\s+\d+\/100[^.,]*[.,]?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function main() {
  const { data, error } = await sb
    .from("daily_entries")
    .select(
      "id, user_id, date, sleep_h, sleep_deep_min, sleep_light_min, sleep_rem_min, sleep_awake_min, sleep_notes",
    );
  if (error) {
    console.error("query failed:", error.message);
    process.exit(1);
  }
  const rows = (data ?? []) as DailyRow[];

  let touched = 0;
  let skipped = 0;
  let bodyBatteryFiles = 0;

  for (const row of rows) {
    const notes = row.sleep_notes ?? "";
    if (!notes.trim()) {
      skipped++;
      continue;
    }

    const deep = row.sleep_deep_min ?? parseStage(notes, "deep");
    const light = row.sleep_light_min ?? parseStage(notes, "light");
    const rem = row.sleep_rem_min ?? parseStage(notes, "rem");
    const awake = row.sleep_awake_min ?? parseStage(notes, "awake");

    const bb = parseBodyBatteryCharge(notes);

    const wantsStageUpdate =
      (row.sleep_deep_min == null && deep != null) ||
      (row.sleep_light_min == null && light != null) ||
      (row.sleep_rem_min == null && rem != null) ||
      (row.sleep_awake_min == null && awake != null);

    const wantsBodyBatteryFile = bb != null;
    const stripped = stripSleepStages(stripBodyBattery(notes));
    const wantsNoteRewrite = stripped !== notes;

    if (!wantsStageUpdate && !wantsBodyBatteryFile && !wantsNoteRewrite) {
      skipped++;
      continue;
    }

    console.log(`\n${row.date} (${row.user_id.slice(0, 8)}…)`);
    if (wantsStageUpdate) {
      console.log(
        `  stages: deep=${deep ?? "—"} light=${light ?? "—"} rem=${rem ?? "—"} awake=${awake ?? "—"}`,
      );
    }
    if (wantsBodyBatteryFile) {
      console.log(`  body battery charge: +${bb}`);
    }
    if (wantsNoteRewrite) {
      console.log(`  sleep_notes:`);
      console.log(`    before: ${notes}`);
      console.log(`    after:  ${stripped}`);
    }

    if (isDry) {
      touched++;
      continue;
    }

    if (wantsStageUpdate || wantsNoteRewrite) {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (deep != null && row.sleep_deep_min == null) patch.sleep_deep_min = deep;
      if (light != null && row.sleep_light_min == null) patch.sleep_light_min = light;
      if (rem != null && row.sleep_rem_min == null) patch.sleep_rem_min = rem;
      if (awake != null && row.sleep_awake_min == null) patch.sleep_awake_min = awake;
      if (wantsNoteRewrite) patch.sleep_notes = stripped || null;

      const { error: upErr } = await sb
        .from("daily_entries")
        .update(patch)
        .eq("id", row.id);
      if (upErr) {
        console.error(`  update failed: ${upErr.message}`);
        continue;
      }
    }

    if (wantsBodyBatteryFile) {
      const path = `daily/${row.date}.md`;
      const existing = await sb
        .from("documents")
        .select("id, content")
        .eq("user_id", row.user_id)
        .eq("path", path)
        .maybeSingle();

      const garminBlock = `## Garmin\n\n### Body Battery\n- Charged: +${bb}\n`;
      let body: string;
      if (existing.data) {
        const has = /## Garmin\b/.test(existing.data.content ?? "");
        body = has
          ? (existing.data.content as string).replace(
              /## Garmin[\s\S]*?(?=\n## |$)/,
              garminBlock,
            )
          : `${existing.data.content}\n\n${garminBlock}`;
      } else {
        body = `# Vendor scores · ${row.date}\n\n${garminBlock}`;
      }

      const writeRes = existing.data
        ? await sb
            .from("documents")
            .update({ content: body, updated_at: new Date().toISOString() })
            .eq("id", existing.data.id)
        : await sb
            .from("documents")
            .insert({ user_id: row.user_id, path, content: body });
      if (writeRes.error) {
        console.error(`  daily/ write failed: ${writeRes.error.message}`);
      } else {
        bodyBatteryFiles++;
      }
    }

    touched++;
  }

  console.log(
    `\n${isDry ? "DRY RUN — " : ""}touched ${touched}, skipped ${skipped}, wrote ${bodyBatteryFiles} daily/ files.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
