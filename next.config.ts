import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // OAuth 2.0 Authorization Server Metadata (RFC 8414).
      // App Router can't host a folder starting with "." so the route lives
      // at /api/oauth/metadata and we expose it at the standard path here.
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/metadata",
      },
    ];
  },
};

export default nextConfig;
