export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const allowedOrigins = ["https://rgboo.com", "http://localhost:5173"];


    // Handle API requests
    if (url.pathname.startsWith("/api/")) {
      const targetUrl = "https://api.rgboo.com" + url.pathname;

      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": request.headers.get("Origin") && allowedOrigins.includes(request.headers.get("Origin")) ? request.headers.get("Origin") : "",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      // Debug: Log environment variables (remove after testing)
      console.log('CF_ACCESS_ID exists:', !!env.CF_ACCESS_ID);
      console.log('CF_ACCESS_SECRET exists:', !!env.CF_ACCESS_SECRET);
      console.log('Target URL:', targetUrl);
      
      // Log first few chars of credentials (for debugging - remove in production)
      console.log('CF_ACCESS_ID starts with:', env.CF_ACCESS_ID?.substring(0, 8) + '...');
      console.log('CF_ACCESS_SECRET starts with:', env.CF_ACCESS_SECRET?.substring(0, 8) + '...');
      
      // Forward request to API
      const apiResp = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          "CF-Access-Client-Id": env.CF_ACCESS_ID,
          "CF-Access-Client-Secret": env.CF_ACCESS_SECRET,
        },
        body: request.method !== "GET" ? await request.text() : undefined,
      });

      console.log('API Response status:', apiResp.status);
      console.log('API Response ok:', apiResp.ok);
      
      // Log response headers to see what Cloudflare Access is returning
      const responseHeaders = {};
      for (const [key, value] of apiResp.headers.entries()) {
        responseHeaders[key] = value;
      }
      console.log('API Response headers:', responseHeaders);
      
      // Clone response to read body for logging without consuming it
      const responseClone = apiResp.clone();
      const responseText = await responseClone.text();
      console.log('API Response body (first 500 chars):', responseText.substring(0, 500));

      // Clone headers + add CORS
      const newHeaders = new Headers(apiResp.headers);
      const origin = request.headers.get("Origin");
      if (origin && allowedOrigins.includes(origin)) {
        newHeaders.set("Access-Control-Allow-Origin", origin);
      }

      return new Response(apiResp.body, {
        status: apiResp.status,
        headers: newHeaders,
      });
    }

    // Default: return 404 for non-API routes
    return new Response("Not found", { status: 404 });
  }
};
