/**
 * Cloudflare Worker for rgboo.com.
 *
 * Serves the static app and proxies /api/* and api-admin.rgboo.com to whichever middleware is
 * currently live, adding the credentials that upstream expects. The
 * frontend never holds an API secret. The Worker authenticates both public
 * and admin API calls to Cloud Run with its API key.
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

    // api-admin.rgboo.com is protected by Cloudflare Access. It proxies the
    // admin API directly, using the same Worker-to-Cloud Run credential as the
    // public API.
    if (url.hostname === "api-admin.rgboo.com") {
      const upstream = env.API_UPSTREAM || DEFAULT_API_UPSTREAM;
      const targetUrl = upstream.replace(/\/$/, "") + url.pathname + url.search;
      const headers = new Headers(upstreamHeaders(env));

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "https://rgboo.com",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== "GET" && request.method !== "HEAD"
          ? await request.text()
          : undefined,
      });
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "https://rgboo.com");
      responseHeaders.set("Vary", "Origin");
      return new Response(response.body, { status: response.status, headers: responseHeaders });
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
