/**
 * Base URL for building absolute links (e.g. the /view/{id} page URL returned
 * to MCP clients). Vercel sets VERCEL_PROJECT_PRODUCTION_URL to the stable
 * production domain (e.g. arduino-playground.vercel.app) regardless of
 * whether the code is running in a Production or Preview deployment - that's
 * what we want links to point at, rather than VERCEL_URL, which is the
 * current deployment's own (often hash-based) URL. APP_URL lets you override
 * either (e.g. for a custom domain) or set it for local development.
 */
export function getBaseUrl(): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
