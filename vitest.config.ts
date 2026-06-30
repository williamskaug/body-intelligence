import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Resolve the "@/..." path alias (matching tsconfig paths) so tests can import
// modules that themselves import "@/lib/...". adminClient() reads env lazily,
// so importing a tool module has no side effects — tests exercise the exported
// Zod schemas and pure functions without touching a database.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
