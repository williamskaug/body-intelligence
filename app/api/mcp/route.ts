import { NextResponse, type NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { lookupAccessToken } from "@/lib/oauth/storage";
import { buildMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WWW_AUTHENTICATE = `Bearer realm="body-intelligence", error="invalid_token"`;

async function handle(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    return NextResponse.json(
      { error: "invalid_token", error_description: "Missing Bearer token." },
      { status: 401, headers: { "WWW-Authenticate": WWW_AUTHENTICATE } },
    );
  }

  const token = match[1].trim();
  const session = await lookupAccessToken(token);
  if (!session) {
    return NextResponse.json(
      { error: "invalid_token", error_description: "Token is invalid or expired." },
      { status: 401, headers: { "WWW-Authenticate": WWW_AUTHENTICATE } },
    );
  }

  const server = buildMcpServer({
    userId: session.userId,
    clientId: session.clientId,
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: every request is fully self-contained, no session resumption.
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function DELETE(request: NextRequest) {
  return handle(request);
}
