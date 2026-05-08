import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fsReadInputSchema, fsRead } from "./tools/fs-read";

export type McpContext = {
  userId: string;
  clientId: string;
};

/**
 * Build a fresh MCP server scoped to one authenticated user. Each request to
 * /api/mcp creates a new instance — tool callbacks close over `ctx.userId`,
 * so cross-tenant access is structurally impossible.
 */
export function buildMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer({
    name: "body-intelligence",
    version: "0.1.0",
  });

  server.registerTool(
    "fs_read",
    {
      title: "Read a memory document",
      description:
        "Read one of the user's standard memory documents (PROFILE.md, PRINCIPLES.md, GOALS.md, CURRENT.md, HEALTH_LOG.md, NUTRITION.md, EQUIPMENT.md, MEMORY.md) or any document the user has fs_write'n.",
      inputSchema: fsReadInputSchema,
    },
    async (input) => {
      const content = await fsRead(ctx.userId, input);
      return { content: [{ type: "text", text: content }] };
    },
  );

  return server;
}
