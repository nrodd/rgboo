/**
 * Cloudflare Worker for rgboo.com.
 *
 * Serves the static app and proxies /api/* and /admin-api/* to the Cloud Run
 * API, adding the API key that upstream expects. The frontend never holds a
 * secret: both public and admin API calls are authenticated here.
 *
 * Which API it targets is the API_UPSTREAM var in wrangler.jsonc, so
 * pointing at a different deployment is a config change, not a code change.
 */

const DEFAULT_API_UPSTREAM =
  "https://rgboo-api-186324327580.us-east1.run.app";

const ALLOWED_ORIGINS = ["https://rgboo.com"];

/** The origin to echo back, or null when it isn't one we allow. */
function allowedOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

/** Credentials for the upstream currently in API_UPSTREAM. */
function upstreamHeaders(env) {
  const headers = { "Content-Type": "application/json" };

  // Cloud Run: a shared secret checked in-app.
  if (env.API_KEY) {
    headers["X-Api-Key"] = env.API_KEY;
  }

  return headers;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Admin calls are same-origin from the Cloudflare Access-protected /admin
    // page. Rewrite the Worker path to the API's existing /admin/* routes and
    // authenticate them exactly like the public API.
    if (url.pathname.startsWith("/admin-api/")) {
      const adminPath = url.pathname === "/admin-api/health"
        ? "/"
        : url.pathname.replace(/^\/admin-api/, "/admin");
      const upstream = env.API_UPSTREAM || DEFAULT_API_UPSTREAM;
      const targetUrl = upstream.replace(/\/$/, "") + adminPath + url.search;
      const headers = upstreamHeaders(env);
      return fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== "GET" && request.method !== "HEAD"
          ? await request.text()
          : undefined,
      });
    }

    // Handle API requests
    if (url.pathname.startsWith("/api/")) {
      const upstream = env.API_UPSTREAM || DEFAULT_API_UPSTREAM;
      const targetUrl = upstream.replace(/\/$/, "") + url.pathname + url.search;

      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": allowedOrigin(request) ?? "",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      // Forward request to API
      const apiResp = await fetch(targetUrl, {
        method: request.method,
        headers: upstreamHeaders(env),
        body: request.method !== "GET" ? await request.text() : undefined,
      });

      // Clone headers + add CORS
      const newHeaders = new Headers(apiResp.headers);
      const origin = allowedOrigin(request);
      if (origin) {
        newHeaders.set("Access-Control-Allow-Origin", origin);
      }

      return new Response(apiResp.body, {
        status: apiResp.status,
        headers: newHeaders,
      });
    }

    // Default: return 404 for non-API routes
    return new Response("Not found", { status: 404 });
  },
};
