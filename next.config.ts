import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/components/registry.ts and lib/diagram/validate.ts read these with
  // fs at runtime (not a static import), so Vercel's file tracing wouldn't
  // bundle them into the serverless function without this.
  outputFileTracingIncludes: {
    "/api/mcp": ["./data/components/*.json", "./schema/*.json"],
  },
};

export default nextConfig;
