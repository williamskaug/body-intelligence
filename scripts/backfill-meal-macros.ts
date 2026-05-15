/**
 * One-shot backfill: estimate kcal + macros for meals rows that are missing
 * them, using Claude's understanding of the free-text description. Required
 * because production has 9 of 10 meals with null macros, and the upcoming
 * NOT NULL migration would reject any new write that doesn't carry macros —
 * we don't want to leave the existing rows in a non-conforming state.
 *
 * Run with:
 *   pnpm dlx tsx --env-file=.env.local scripts/backfill-meal-macros.ts --dry
 *   pnpm dlx tsx --env-file=.env.local scripts/backfill-meal-macros.ts
 *
 * --dry             Show what would change without writing.
 * --limit N         Process at most N rows this run (default: all).
 * --model NAME      Override the default Claude model.
 *
 * Estimation prompt asks Claude to return JSON; if Claude returns "I can't
 * estimate this", we log the row and skip it for manual review.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
if (!url || !key || !anthropicKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ANTHROPIC_API_KEY.",
  );
  process.exit(1);
}
const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anthropic = new Anthropic({ apiKey: anthropicKey });

const args = process.argv.slice(2);
const isDry = args.includes("--dry");
const limitArg = args.includes("--limit")
  ? Number(args[args.indexOf("--limit") + 1])
  : Number.POSITIVE_INFINITY;
const model = args.includes("--model")
  ? args[args.indexOf("--model") + 1] ?? "claude-haiku-4-5-20251001"
  : "claude-haiku-4-5-20251001";

type MealRow = {
  id: string;
  user_id: string;
  eaten_at: string;
  meal_type: string | null;
  description: string;
  calories: number | null;
  protein_g: string | null;
  carbs_g: string | null;
  fat_g: string | null;
  fiber_g: string | null;
};

type Estimate = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  confidence: "high" | "medium" | "low";
  rationale: string;
} | { skip: true; reason: string };

const SYSTEM = `You are a nutrition estimator. The user has logged a meal as free text and the system needs estimated kcal + macros for it. Return a single JSON object with this exact shape:

{ "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number, "confidence": "high" | "medium" | "low", "rationale": "one short sentence" }

OR — if the description is too ambiguous to estimate without guessing wildly (e.g. just "dinner", "snack", or a single uncountable noun) — return:

{ "skip": true, "reason": "one short sentence" }

Be reasonable: estimates are better than nothing for trending. Use medium confidence for ordinary home meals you can imagine clearly. Only return skip if you'd be making up the entire portion size from thin air. Numbers are absolute grams / kcal for the whole meal, not per serving.`;

async function estimate(description: string, mealType: string | null): Promise<Estimate> {
  const ctx = mealType ? `Meal type: ${mealType}\n` : "";
  const resp = await anthropic.messages.create({
    model,
    max_tokens: 400,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${ctx}Description: ${description}\n\nReturn the JSON object only — no surrounding prose.`,
      },
    ],
  });

  const textBlock = resp.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { skip: true, reason: "Claude returned no text content" };
  }
  const raw = textBlock.text.trim();
  // Strip code fences if Claude added them.
  const jsonText = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(jsonText) as Estimate;
  } catch {
    return { skip: true, reason: `parse failed: ${raw.slice(0, 120)}` };
  }
}

async function main() {
  const { data, error } = await sb
    .from("meals")
    .select("id, user_id, eaten_at, meal_type, description, calories, protein_g, carbs_g, fat_g, fiber_g")
    .or("calories.is.null,protein_g.is.null,carbs_g.is.null,fat_g.is.null")
    .order("eaten_at", { ascending: true });
  if (error) {
    console.error("query failed:", error.message);
    process.exit(1);
  }
  const rows = (data ?? []) as MealRow[];
  console.log(`Found ${rows.length} meals with missing macros.`);
  if (Number.isFinite(limitArg)) {
    console.log(`(processing at most ${limitArg})`);
  }

  let touched = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows.slice(0, Number.isFinite(limitArg) ? limitArg : undefined)) {
    console.log(`\n${row.eaten_at} (${row.id.slice(0, 8)}…): ${row.description.slice(0, 80)}${row.description.length > 80 ? "…" : ""}`);
    let est: Estimate;
    try {
      est = await estimate(row.description, row.meal_type);
    } catch (e) {
      console.error(`  estimate failed: ${e instanceof Error ? e.message : String(e)}`);
      failed++;
      continue;
    }
    if ("skip" in est) {
      console.log(`  skip: ${est.reason}`);
      skipped++;
      continue;
    }
    console.log(
      `  ${Math.round(est.calories)}kcal · ${Math.round(est.protein_g)}p/${Math.round(est.carbs_g)}c/${Math.round(est.fat_g)}f${est.fiber_g != null ? `/${Math.round(est.fiber_g)}fiber` : ""}  (${est.confidence} · ${est.rationale})`,
    );
    if (isDry) {
      touched++;
      continue;
    }
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (row.calories == null) patch.calories = Math.round(est.calories);
    if (row.protein_g == null) patch.protein_g = est.protein_g;
    if (row.carbs_g == null) patch.carbs_g = est.carbs_g;
    if (row.fat_g == null) patch.fat_g = est.fat_g;
    if (row.fiber_g == null && est.fiber_g != null) patch.fiber_g = est.fiber_g;

    // Note in notes that the macros were LLM-estimated, for transparency.
    const existingNotes = (await sb.from("meals").select("notes").eq("id", row.id).maybeSingle()).data?.notes;
    const stamp = `[macros backfilled ${new Date().toISOString().slice(0, 10)} via ${model}, ${est.confidence} confidence: ${est.rationale}]`;
    patch.notes = existingNotes ? `${existingNotes}\n${stamp}` : stamp;

    const { error: upErr } = await sb.from("meals").update(patch).eq("id", row.id);
    if (upErr) {
      console.error(`  update failed: ${upErr.message}`);
      failed++;
      continue;
    }
    touched++;
  }

  console.log(
    `\n${isDry ? "DRY RUN — " : ""}touched ${touched}, skipped ${skipped}, failed ${failed}.`,
  );
  if (skipped > 0 && !isDry) {
    console.log(
      `\n${skipped} row(s) could not be estimated. Either resolve manually via update_meal or accept that they'll fail the upcoming NOT NULL constraint and need to be deleted before the migration runs.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
