# /new-tool

Scaffold a new MCP tool consistently with the existing surface.

## When to use

- The user wants to add a new MCP tool to the Body Intelligence surface
- Or they describe a capability that isn't covered by the existing seven tools

## What to do

Follow this checklist in order:

1. **Confirm the shape with the user before writing code.** Tool name (snake_case), one-sentence purpose, input arguments, return shape.

2. **Create the Zod schema in `lib/schemas/`.** One named export per tool: `{toolName}InputSchema`. Mirror the Drizzle row type as closely as possible — reuse `z.infer` from the table types where it fits.

3. **Create the tool implementation in `lib/mcp/tools/{tool-name}.ts`.**
   ```ts
   export async function toolName(input: ToolNameInput, ctx: ToolContext): Promise<ToolNameOutput> {
     // 1. Validate (already done by the registry — input is typed)
     // 2. Authorize (RLS handles row scoping, but check business rules here)
     // 3. Execute via ctx.db (Drizzle)
     // 4. Return a small typed result
   }
   ```

4. **Register the tool in `lib/mcp/server.ts`** — add it to the registry array. The MCP server bootstrap reads from this array; no other registration step.

5. **Write tests in `lib/mcp/tools/{tool-name}.test.ts`.** Minimum: one happy-path test with a valid input, one validation-failure test asserting Zod rejects bad input.

6. **Update `docs/mcp-tools.md`.** Add a section for the new tool — same template as the existing seven.

7. **Update `CLAUDE.md` § MCP surface** — increment the tool count and add the new verb to the list.

## Conventions to enforce

- Tools are pure functions of `(input, ctx)`. No global state, no module-level mutable variables.
- Tools never accept a `user_id` argument. The user is determined by the OAuth bearer token; RLS enforces scoping.
- Errors thrown by the tool surface as MCP error responses with a `code` field that the client can switch on.
- If a tool returns more than ~50 rows, paginate. Cap at 200 absolute max.
- Free-text fields use `text` (not `varchar(n)`) — premature length limits cause friction.
