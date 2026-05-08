# Body Intelligence

A passive memory layer for the athlete-self. Stores workouts, sleep, nutrition, wellness, and health events as structured rows plus a small library of markdown memory files. Exposes an MCP surface so Claude can read and write everything via natural conversation — and reason over it without the app having any opinions of its own.

The same architectural shape as Project Intelligence, applied to the body.

## Status

Greenfield. Architecture locked, ready to scaffold. See `CLAUDE.md` for the full design.

## Stack

Next.js 15 · TypeScript · Supabase (Postgres + Auth) · Drizzle ORM · Zod · `@modelcontextprotocol/sdk` · OAuth 2.1 + DCR · shadcn/ui · Vercel.

## Documentation

- `CLAUDE.md` — orientation for Claude sessions; the source of truth for the design
- `docs/architecture.md` — rationale behind the locked decisions
- `docs/schema.md` — table definitions and RLS policies
- `docs/mcp-tools.md` — the seven-tool MCP surface
- `docs/recipes.md` — scheduled-agent recipe spec and starter prompts

## Quick start

Not scaffolded yet. The next step is in `CLAUDE.md` § *Status tracker → Next*.
