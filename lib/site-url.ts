/**
 * Base URL for building absolute links (e.g. the /view/{id} page URL returned
 * to MCP clients). Vercel sets VERCEL_URL automatically; APP_URL lets you
 * override it (e.g. for a custom domain) or set it for local development.
 */
export function getBaseUrl(): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
