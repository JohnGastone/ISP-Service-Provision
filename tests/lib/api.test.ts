import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The API module reads the session cookie; stub it before importing.
vi.mock("@/lib/session", () => ({
  getCredential: vi.fn(async () => "YWRtaW46Y2hhbmdlLW1l"),
}));

import {
  ApiRequestError,
  ApiUnreachableError,
  apiFetch,
  approveRequest,
  createCustomer,
  defaultMessageFor,
  listCustomers,
  listPools,
  listMyRequests,
  problemMessage,
  rejectRequest,
  updatePool,
  verifyCredential,
} from "@/lib/api";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("problemMessage", () => {
  it("prefers the ProblemDetail `detail` field", () => {
    const problem = {
      type: "about:blank",
      title: "Unprocessable Entity",
      status: 422,
      detail: "Pool 1 cannot cover request 10: needs 400/500 Mbps",
    };
    expect(problemMessage(problem, 422)).toBe(problem.detail);
  });

  it("falls back to title, then to a status default", () => {
    expect(problemMessage({ title: "Conflict" }, 409)).toBe("Conflict");
    expect(problemMessage(null, 409)).toBe(defaultMessageFor(409));
  });

  it("maps each status the API documents to a readable message", () => {
    expect(defaultMessageFor(400)).toMatch(/rejected/i);
    expect(defaultMessageFor(401)).toMatch(/sign in/i);
    expect(defaultMessageFor(403)).toMatch(/permission/i);
    expect(defaultMessageFor(404)).toMatch(/not be found/i);
    expect(defaultMessageFor(409)).toMatch(/already been decided/i);
    expect(defaultMessageFor(422)).toMatch(/could not be fulfilled/i);
  });
});

describe("apiFetch", () => {
  it("sends HTTP Basic auth from the stored credential", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await apiFetch("/api/auth/me");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Basic YWRtaW46Y2hhbmdlLW1l");
  });

  it("lets an explicit credential override the stored one", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await apiFetch("/api/auth/login", { method: "POST", credential: "T1RIRVI=" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Basic T1RIRVI=");
  });

  it("serialises a JSON body and sets the content type", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await apiFetch("/api/customers", { method: "POST", body: { name: "Acme" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(JSON.stringify({ name: "Acme" }));
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("never caches responses", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await apiFetch("/api/customers");
    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
  });

  it("throws ApiRequestError carrying the ProblemDetail message and status", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 422, detail: "needs 400/500 Mbps, remaining 100/100" }, 422),
    );

    await expect(apiFetch("/x")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 422,
      message: "needs 400/500 Mbps, remaining 100/100",
    });
  });

  it("throws ApiUnreachableError when the host cannot be contacted", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const error = await apiFetch("/api/auth/login").catch((e) => e);
    expect(error).toBeInstanceOf(ApiUnreachableError);
    expect(error.message).toMatch(/Could not connect to/);
    expect(error.target).toContain("/api/auth/login");
  });

  it("reports a timeout distinctly, naming the target", async () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    fetchMock.mockRejectedValue(timeout);

    const error = await apiFetch("/api/auth/login").catch((e) => e);
    expect(error).toBeInstanceOf(ApiUnreachableError);
    expect(error.message).toMatch(/No response from .*within \d+ms/);
  });

  it("passes an abort signal so an unreachable host fails fast", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await apiFetch("/api/auth/me");
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });

  it("returns null for an empty body (204-style responses)", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    await expect(apiFetch("/x")).resolves.toBeNull();
  });

  it("wraps a non-JSON error body as a detail message", async () => {
    fetchMock.mockResolvedValue(new Response("Internal error", { status: 500 }));
    await expect(apiFetch("/x")).rejects.toMatchObject({ message: "Internal error" });
  });
});

describe("endpoint helpers hit the documented paths", () => {
  beforeEach(() => fetchMock.mockResolvedValue(jsonResponse([])));

  const url = () => fetchMock.mock.calls[0][0] as string;
  const init = () => fetchMock.mock.calls[0][1];

  it("verifyCredential posts to /api/auth/login", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ username: "admin", admin: true }));
    await verifyCredential("abc");
    expect(url()).toMatch(/\/api\/auth\/login$/);
    expect(init().method).toBe("POST");
  });

  it("listCustomers gets /api/customers", async () => {
    await listCustomers();
    expect(url()).toMatch(/\/api\/customers$/);
  });

  it("createCustomer posts the nested location shape the API expects", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1 }, 201));
    await createCustomer({
      name: "Acme",
      email: "ops@acme.co.tz",
      phone: "+255712345678",
      location: { district: "Kinondoni", region: "Dar es Salaam" },
    });
    expect(JSON.parse(init().body).location).toEqual({
      district: "Kinondoni",
      region: "Dar es Salaam",
    });
  });

  it("listPools gets /api/bandwidth/pools", async () => {
    await listPools();
    expect(url()).toMatch(/\/api\/bandwidth\/pools$/);
  });

  it("updatePool puts to the pool id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1 }));
    await updatePool(1, { totalUploadMbps: 2000, totalDownloadMbps: 2000 });
    expect(url()).toMatch(/\/api\/bandwidth\/pools\/1$/);
    expect(init().method).toBe("PUT");
  });

  it("listMyRequests gets the customer-scoped path", async () => {
    await listMyRequests();
    expect(url()).toMatch(/\/api\/bandwidth\/requests\/mine$/);
  });

  it("approveRequest posts a note only when supplied", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 10 }));
    await approveRequest(10, "approved for Q3");
    expect(url()).toMatch(/\/api\/bandwidth\/requests\/10\/approve$/);
    expect(JSON.parse(init().body)).toEqual({ note: "approved for Q3" });

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(jsonResponse({ id: 10 }));
    await approveRequest(10);
    expect(JSON.parse(init().body)).toEqual({});
  });

  it("rejectRequest always sends the required note", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 11 }));
    await rejectRequest(11, "duplicate");
    expect(url()).toMatch(/\/api\/bandwidth\/requests\/11\/reject$/);
    expect(JSON.parse(init().body)).toEqual({ note: "duplicate" });
  });
});

describe("list unwrapping", () => {
  it("accepts a bare array", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 1 }]));
    await expect(listCustomers()).resolves.toHaveLength(1);
  });

  it("accepts a Spring Page envelope", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [{ id: 1 }, { id: 2 }] }));
    await expect(listCustomers()).resolves.toHaveLength(2);
  });

  it("degrades to an empty list for an unexpected shape", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ unexpected: true }));
    await expect(listCustomers()).resolves.toEqual([]);
  });
});

describe("ApiRequestError", () => {
  it("carries the status for callers that branch on it", () => {
    const error = new ApiRequestError("nope", 409);
    expect(error.status).toBe(409);
    expect(error).toBeInstanceOf(Error);
  });
});
