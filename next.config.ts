import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @resvg/resvg-js loads its native addon via a dynamic require that
  // confuses Turbopack's bundler ("non-ecmascript placeable asset"); this
  // tells Next to leave it as a plain runtime require instead of bundling it
  // (the same treatment sharp gets by default for the same reason).
  serverExternalPackages: ["@resvg/resvg-js"],
  // The diagram rendering pipeline (component registry, diagram schema, bundled
  // fonts) is read via fs at runtime, not a static import, in both /api/mcp and
  // /view/[id]/image (which can also trigger a render). Vercel's file tracing
  // only follows imports, so without this these wouldn't ship with the
  // function. /* applies to every route, matching Next's own recommended
  // pattern for this kind of cross-cutting runtime asset.
  outputFileTracingIncludes: {
    "/*": ["./data/components/*.json", "./schema/*.json", "./assets/fonts/*.ttf"],
  },
};

export default nextConfig;
