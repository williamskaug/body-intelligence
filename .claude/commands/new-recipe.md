# /new-recipe

Add a scheduled-agent recipe to the BI library.

## When to use

- The user describes a recurring task they want a Cowork scheduled agent to handle
- Or they want to add an entry to the `/agents` recipe library

## What to do

1. **Pin the shape with the user.** Title (4-6 words), category (`capture` | `review` | `connector` | `planning`), schedule (cron), and what should happen each run.

2. **Draft the prompt.** Recipes are prompts, not code. The prompt instructs Claude on what to do during a run. Keep it tight — under 500 words. Reference the BI MCP tools by name. Reference memory files by path (`PROFILE.md`, `PRINCIPLES.md`, etc.).

3. **List `required_tools`.** This determines whether the recipe can run in a given Cowork setup. Use the exact MCP tool names: `log_workout`, `log_daily`, `fs_read`, etc.

4. **Add the recipe entry to `lib/agents/recipe-data.ts`.** The array order is the display order on `/agents` — group by category.

5. **Update `docs/recipes.md`** with the full prompt for human review.

6. **No CLAUDE.md change needed** — the recipe count is dynamic, not architectural.

## Recipe template

```ts
{
  id: "kebab-case-id",
  title: "Human-readable title",
  category: "capture" | "review" | "connector" | "planning",
  schedule: "0 7 * * *",                       // cron, UTC unless noted
  description: "One sentence visible on the recipe card.",
  prompt: `<full prompt — see docs/recipes.md for examples>`,
  required_tools: ["log_daily", "fs_read"],
}
```

## Quality bar

- The prompt must work for someone who has never read the BI codebase. Don't reference internal types or function signatures.
- The prompt should fail gracefully — "if no GOALS.md exists, ask the user for their current goal" rather than assuming state.
- Schedule must be sane for the user's timezone. Cron in UTC; document the local-time intent in the description.
