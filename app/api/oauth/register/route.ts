import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { registerClient } from "@/lib/oauth/storage";

export const runtime = "nodejs";

const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(200),
  redirect_uris: z.array(z.string().url()).min(1).max(20),
  token_endpoint_auth_method: z
    .enum(["none", "client_secret_post"])
    .optional()
    .default("none"),
  // Permissive on extras the spec allows (grant_types, response_types, scope,
  // logo_uri, etc.) — we accept and ignore them for now.
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_client_metadata", "Body must be valid JSON", 400);
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "invalid_client_metadata",
      parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; "),
      400,
    );
  }

  const { client_name, redirect_uris, token_endpoint_auth_method } = parsed.data;
  const isPublic = token_endpoint_auth_method === "none";

  const client = await registerClient({
    name: client_name,
    redirectUris: redirect_uris,
    isPublic,
  });

  return NextResponse.json(
    {
      client_id: client.clientId,
      ...(client.clientSecret ? { client_secret: client.clientSecret } : {}),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201 },
  );
}

function errorResponse(error: string, description: string, status: number) {
  return NextResponse.json({ error, error_description: description }, { status });
}
