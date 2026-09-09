import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCredential } = vi.hoisted(() => ({ getCredential: vi.fn() }));

vi.mock("@/lib/session", () => ({ getCredential }));

import { GET, POST, PUT, PATCH, DELETE } from "@/app/api/proxy/[...path]/route";

const fetchMock = vi.fn();

function ctx(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  getCredential.mockReset();
  getCredential.mockResolvedValue("YWRtaW46Y2hhbmdlLW1l");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authentication boundary", () => {
  it("refuses to forward without a stored credential", async () => {
    getCredential.mockResolvedValue(null);

    const res = await GET(
      new Request("http://localhost:3000/api/proxy/api/customers"),
      ctx(["api", "customers"]),
    );

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("attaches HTTP Basic auth from the httpOnly cookie", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await GET(
      new Request("http://localhost:3000/api/proxy/api/customers"),
      ctx(["api", "customers"]),
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Basic YWRtaW46Y2hhbmdlLW1l");
  });
});

describe("request forwarding", () => {
  it("rebuilds the upstream path from the catch-all segments", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await POST(
      new Request("http://localhost:3000/api/proxy/api/bandwidth/requests/10/approve", {
        method: "POST",
        body: JSON.stringify({ note: "ok" }),
      }),
      ctx(["api", "bandwidth", "requests", "10", "approve"]),
    );

    expect(fetchMock.mock.calls[0][0]).toMatch(
      /\/api\/bandwidth\/requests\/10\/approve$/,
    );
  });

  it("preserves the query string", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await GET(
      new Request("http://localhost:3000/api/proxy/api/customers?q=acme&page=2"),
      ctx(["api", "customers"]),
    );

    expect(fetchMock.mock.calls[0][0]).toContain("?q=acme&page=2");
  });

  it("forwards the body for write methods", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const body = JSON.stringify({ totalUploadMbps: 2000, totalDownloadMbps: 2000 });

    await PUT(
      new Request("http://localhost:3000/api/proxy/api/bandwidth/pools/1", {
        method: "PUT",
        body,
      }),
      ctx(["api", "bandwidth", "pools", "1"]),
    );

    expect(fetchMock.mock.calls[0][1].body).toBe(body);
    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBe("application/json");
  });

  it("does not send a body for GET or DELETE", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await DELETE(
      new Request("http://localhost:3000/api/proxy/api/customers/1", { method: "DELETE" }),
      ctx(["api", "customers", "1"]),
    );

    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it("supports PATCH", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await PATCH(
      new Request("http://localhost:3000/api/proxy/api/x", {
        method: "PATCH",
        body: "{}",
      }),
      ctx(["api", "x"]),
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  });
});

describe("response passthrough", () => {
  it.each([400, 403, 404, 409, 422])(
    "passes status %s and the ProblemDetail body straight through",
    async (status) => {
      const problem = { type: "about:blank", status, detail: `failure ${status}` };
      fetchMock.mockResolvedValue(jsonResponse(problem, status));

      const res = await POST(
        new Request("http://localhost:3000/api/proxy/api/x", {
          method: "POST",
          body: "{}",
        }),
        ctx(["api", "x"]),
      );

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual(problem);
    },
  );

  it("returns 503 with the target when the backend is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const res = await GET(
      new Request("http://localhost:3000/api/proxy/api/customers"),
      ctx(["api", "customers"]),
    );

    expect(res.status).toBe(503);
    expect((await res.json()).detail).toMatch(/Cannot reach the API service at http/);
  });

  it("fails fast using an abort signal", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await GET(
      new Request("http://localhost:3000/api/proxy/api/customers"),
      ctx(["api", "customers"]),
    );
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });
});
