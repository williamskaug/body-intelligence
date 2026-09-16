import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default dynamic staleTime is 0, so every sidebar click waited on a full
    // RSC refetch. 60s lets Today↔Train↔Body feel instant after the first
    // visit within a minute; mutations call refresh() in revalidateApp().
    staleTimes: {
      dynamic: 60,
      static: 180,
    },
  },
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
