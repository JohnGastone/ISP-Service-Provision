import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientApiError, api, local } from "@/lib/client-api";

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

describe("api()", () => {
  it("routes Spring paths through the local proxy so the credential stays server-side", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await api("/api/customers");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/proxy/api/customers");
  });

  it("tolerates a path without a leading slash", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await api("api/customers");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/proxy/api/customers");
  });

  it("never attaches an Authorization header itself", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await api("/api/customers", { method: "POST", body: { a: 1 } });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});

describe("local()", () => {
  it("calls the Next route handler directly", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: {} }));
    await local("/api/auth/login", { method: "POST", body: { username: "a", password: "b" } });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/login");
  });
});

describe("error handling", () => {
  it("surfaces the ProblemDetail `detail` from the backend", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: "Pool 1 cannot cover request 11", status: 422 }, 422),
    );

    const error = (await api("/x").catch((e) => e)) as ClientApiError;
    expect(error).toBeInstanceOf(ClientApiError);
    expect(error.status).toBe(422);
    expect(error.message).toBe("Pool 1 cannot cover request 11");
  });

  it("falls back to a status-specific message when no detail is given", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 409));
    const error = (await api("/x").catch((e) => e)) as ClientApiError;
    expect(error.message).toMatch(/already been decided/i);
  });

  it("reports a network failure with status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("failed to fetch"));
    const error = (await api("/x").catch((e) => e)) as ClientApiError;
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/network error/i);
  });

  it("redirects to the login page on 401", async () => {
    const original = window.location;
    // jsdom forbids assigning location.href directly; replace the object.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, href: "http://localhost/admin" },
    });

    fetchMock.mockResolvedValue(jsonResponse({ detail: "unauthorized" }, 401));
    await api("/x").catch(() => {});

    expect(window.location.href).toBe("/login");
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("handles a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(new Response("upstream exploded", { status: 500 }));
    const error = (await api("/x").catch((e) => e)) as ClientApiError;
    expect(error.message).toBe("upstream exploded");
  });
});

describe("success handling", () => {
  it("parses a JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 1 }]));
    await expect(api("/x")).resolves.toEqual([{ id: 1 }]);
  });

  it("returns null for an empty body", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    await expect(api("/x")).resolves.toBeNull();
  });
});
