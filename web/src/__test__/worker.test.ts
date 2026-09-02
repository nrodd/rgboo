import { test, expect, vi, afterEach } from "vitest";
import worker from "../../worker/index.js";

/**
 * Tests for the Cloudflare Worker that proxies /api/* to the middleware.
 *
 * The upstream fetch is stubbed, so these assert what the Worker *sends* --
 * which upstream URL and which credentials. That is exactly what the GCP
 * cutover changes, and what a rollback has to change back.
 */

const OLD_UPSTREAM = "https://api.rgboo.com";
const NEW_UPSTREAM = "https://rgboo-api-abc123.run.app";

/** Stub the upstream and return the spy, so tests can inspect the call. */
function stubUpstream(response = new Response("{}", { status: 200 })) {
  const spy = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", spy);
  return spy;
}

/** The headers the Worker sent upstream, as a plain object. */
function sentHeaders(spy: ReturnType<typeof vi.fn>) {
  return spy.mock.calls[0][1].headers as Record<string, string>;
}

/**
 * Build a Request that reports an Origin.
 *
 * `Origin` is a forbidden header name, so a browser silently drops it from
 * `new Request(...)` -- but the Workers runtime does deliver it on inbound
 * requests. Setting it on a standalone Headers (which has no guard) and
 * shadowing the instance property reproduces what the Worker actually sees.
 */
function withOrigin(request: Request, origin: string) {
  const headers = new Headers(request.headers);
  headers.set("Origin", origin);
  Object.defineProperty(request, "headers", { value: headers });
  return request;
}

function colorRequest(origin = "https://rgboo.com") {
  return withOrigin(
    new Request("https://rgboo.com/api/color", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "tester", color: { r: 1, g: 2, b: 3 } }),
    }),
    origin,
  );
}

function preflightRequest(origin: string) {
  return withOrigin(
    new Request("https://rgboo.com/api/color", { method: "OPTIONS" }),
    origin,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("when API_UPSTREAM is set then the request is proxied there", async () => {
  const spy = stubUpstream();

  await worker.fetch(colorRequest(), { API_UPSTREAM: NEW_UPSTREAM });

  expect(spy.mock.calls[0][0]).toBe(`${NEW_UPSTREAM}/api/color`);
});

test("when API_UPSTREAM is unset then it falls back to the current upstream", async () => {
  const spy = stubUpstream();

  await worker.fetch(colorRequest(), {});

  expect(spy.mock.calls[0][0]).toBe(`${OLD_UPSTREAM}/api/color`);
});

test("when API_UPSTREAM has a trailing slash then the path is not doubled", async () => {
  const spy = stubUpstream();

  await worker.fetch(colorRequest(), { API_UPSTREAM: `${NEW_UPSTREAM}/` });

  expect(spy.mock.calls[0][0]).toBe(`${NEW_UPSTREAM}/api/color`);
});

test("when API_KEY is configured then it is sent as X-Api-Key", async () => {
  const spy = stubUpstream();

  await worker.fetch(colorRequest(), {
    API_UPSTREAM: NEW_UPSTREAM,
    API_KEY: "cloud-run-secret",
  });

  expect(sentHeaders(spy)["X-Api-Key"]).toBe("cloud-run-secret");
});

test("when Access service tokens are configured then they are sent", async () => {
  const spy = stubUpstream();

  await worker.fetch(colorRequest(), {
    CF_ACCESS_ID: "access-id",
    CF_ACCESS_SECRET: "access-secret",
  });

  const headers = sentHeaders(spy);
  expect(headers["CF-Access-Client-Id"]).toBe("access-id");
  expect(headers["CF-Access-Client-Secret"]).toBe("access-secret");
});

test("when both credential sets are configured then both are sent, so cutover and rollback need no code change", async () => {
  const spy = stubUpstream();

  await worker.fetch(colorRequest(), {
    API_UPSTREAM: NEW_UPSTREAM,
    API_KEY: "cloud-run-secret",
    CF_ACCESS_ID: "access-id",
    CF_ACCESS_SECRET: "access-secret",
  });

  const headers = sentHeaders(spy);
  expect(headers["X-Api-Key"]).toBe("cloud-run-secret");
  expect(headers["CF-Access-Client-Id"]).toBe("access-id");
});

test("when no credentials are configured then no credential headers are sent", async () => {
  const spy = stubUpstream();

  await worker.fetch(colorRequest(), {});

  const headers = sentHeaders(spy);
  expect(headers).not.toHaveProperty("X-Api-Key");
  expect(headers).not.toHaveProperty("CF-Access-Client-Id");
  expect(headers["Content-Type"]).toBe("application/json");
});

test("when the request is a POST then the body is forwarded", async () => {
  const spy = stubUpstream();

  await worker.fetch(colorRequest(), {});

  expect(JSON.parse(spy.mock.calls[0][1].body)).toEqual({
    username: "tester",
    color: { r: 1, g: 2, b: 3 },
  });
});

test("when the request is a GET then no body is sent", async () => {
  const spy = stubUpstream();

  await worker.fetch(
    new Request("https://rgboo.com/api/queue", { method: "GET" }),
    {},
  );

  expect(spy.mock.calls[0][1].method).toBe("GET");
  expect(spy.mock.calls[0][1].body).toBeUndefined();
});

test("when the upstream returns an error status then it is passed through", async () => {
  stubUpstream(
    new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  );

  const response = await worker.fetch(colorRequest(), {});

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "Unauthorized" });
});

test("when the origin is allowed then the proxied response carries CORS headers", async () => {
  stubUpstream();

  const response = await worker.fetch(colorRequest("https://rgboo.com"), {});

  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
    "https://rgboo.com",
  );
});

test("when the origin is not allowed then no CORS header is added", async () => {
  stubUpstream();

  const response = await worker.fetch(colorRequest("https://evil.example"), {});

  expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
});

test("when a preflight comes from an allowed origin then it is answered with 204", async () => {
  const spy = stubUpstream();

  const response = await worker.fetch(
    preflightRequest("https://rgboo.com"),
    {},
  );

  expect(response.status).toBe(204);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
    "https://rgboo.com",
  );
  // A preflight must never be forwarded upstream.
  expect(spy).not.toHaveBeenCalled();
});

test("when a preflight comes from a disallowed origin then no origin is echoed", async () => {
  stubUpstream();

  const response = await worker.fetch(
    preflightRequest("https://evil.example"),
    {},
  );

  expect(response.status).toBe(204);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("");
});

test("when the path is not an API route then it is not proxied", async () => {
  const spy = stubUpstream();

  const response = await worker.fetch(
    new Request("https://rgboo.com/whatever", { method: "GET" }),
    {},
  );

  expect(response.status).toBe(404);
  expect(spy).not.toHaveBeenCalled();
});

test("when an admin path is requested then it rewrites and forwards the Worker API key", async () => {
  const spy = stubUpstream();
  const request = new Request("https://api-admin.rgboo.com/admin/status");

  await worker.fetch(request, { API_UPSTREAM: NEW_UPSTREAM, API_KEY: "worker-secret" });

  expect(spy.mock.calls[0][0]).toBe(`${NEW_UPSTREAM}/admin/status`);
  expect(sentHeaders(spy)["X-Api-Key"]).toBe("worker-secret");
});
