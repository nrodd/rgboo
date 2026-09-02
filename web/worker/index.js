/**
 * Cloudflare Worker for rgboo.com.
 *
 * Serves the static app and proxies /api/* and /admin-api/* to whichever middleware is
 * currently live, adding the credentials that upstream expects. The
 * frontend never holds an API secret. Admin identity comes from the
 * Cloudflare Access JWT attached to requests reaching this Worker.
 *
 * Cutover and rollback (see docs/gcp-migration-plan.md) are a config
 * change, not a code change:
 *
 *   to GCP:  set the API_UPSTREAM var to the Cloud Run URL, put the
 *            API_KEY secret, deploy
 *   back:    set API_UPSTREAM back to https://api.rgboo.com, deploy
 *
 * Credentials are sent when configured, so both sets can coexist during
 * the migration: the old middleware ignores X-Api-Key, and the Cloud Run
 * API ignores the CF-Access headers.
 */

const DEFAULT_API_UPSTREAM = "https://api.rgboo.com";

const ALLOWED_ORIGINS = ["https://rgboo.com", "http://localhost:5173"];

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

  // Cloudflare Tunnel + Access: service token for the home machine.
  if (env.CF_ACCESS_ID && env.CF_ACCESS_SECRET) {
    headers["CF-Access-Client-Id"] = env.CF_ACCESS_ID;
    headers["CF-Access-Client-Secret"] = env.CF_ACCESS_SECRET;
  }

  return headers;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Admin calls are same-origin from the protected /admin page. Rewrite the
    // Worker path to the API's existing /admin/* routes and pass through the
    // signed identity assertion. The API validates it itself.
    if (url.pathname.startsWith("/admin-api/")) {
      const adminPath = url.pathname === "/admin-api/health"
        ? "/"
        : url.pathname.replace(/^\/admin-api/, "/admin");
      const upstream = env.API_UPSTREAM || DEFAULT_API_UPSTREAM;
      const targetUrl = upstream.replace(/\/$/, "") + adminPath + url.search;
      const headers = new Headers({ "Content-Type": "application/json" });
      const accessJwt = request.headers.get("Cf-Access-Jwt-Assertion");
      if (accessJwt) headers.set("Cf-Access-Jwt-Assertion", accessJwt);

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
