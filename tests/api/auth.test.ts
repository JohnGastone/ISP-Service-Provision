import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted, so the mock functions must be created via vi.hoisted.
const { setSession, clearSession, verifyCredential } = vi.hoisted(() => ({
  setSession: vi.fn(),
  clearSession: vi.fn(),
  verifyCredential: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  setSession,
  clearSession,
  getCredential: vi.fn(async () => "YWRtaW46Y2hhbmdlLW1l"),
}));

// Replace only the network call; keep the real error classes and constants.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  verifyCredential,
}));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { ApiRequestError, ApiUnreachableError } from "@/lib/api";

function post(body: unknown) {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  setSession.mockReset();
  clearSession.mockReset();
  verifyCredential.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/login", () => {
  it("stores the base64 credential and returns only display data", async () => {
    verifyCredential.mockResolvedValue({
      username: "admin",
      admin: true,
      role: "ADMIN",
    });

    const res = await login(post({ username: "admin", password: "change-me" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    // btoa("admin:change-me")
    expect(setSession).toHaveBeenCalledWith(
      Buffer.from("admin:change-me").toString("base64"),
      expect.objectContaining({ username: "admin", role: "ADMIN" }),
    );
    // The password must never travel back to the browser.
    expect(JSON.stringify(body)).not.toContain("change-me");
    expect(body.user.role).toBe("ADMIN");
  });

  it("maps a customer principal to the CUSTOMER role", async () => {
    verifyCredential.mockResolvedValue({
      username: "ops@acme.co.tz",
      admin: false,
      role: "CUSTOMER",
    });

    const res = await login(post({ username: "ops@acme.co.tz", password: "cust-pass" }));
    expect((await res.json()).user.role).toBe("CUSTOMER");
  });

  it("falls back to the `admin` flag when `role` is absent", async () => {
    verifyCredential.mockResolvedValue({
      username: "admin",
      admin: true,
    });

    const res = await login(post({ username: "admin", password: "x" }));
    expect((await res.json()).user.role).toBe("ADMIN");
  });

  it("returns 401 with a friendly message for bad credentials", async () => {
    verifyCredential.mockRejectedValue(
      new ApiRequestError("Full authentication is required", 401),
    );

    const res = await login(post({ username: "admin", password: "wrong" }));
    expect(res.status).toBe(401);
    expect((await res.json()).message).toMatch(/incorrect username or password/i);
    expect(setSession).not.toHaveBeenCalled();
  });

  it("returns 503 naming the unreachable target", async () => {
    verifyCredential.mockRejectedValue(
      new ApiUnreachableError("http://192.168.0.56:8080/api/auth/login"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await login(post({ username: "admin", password: "x" }));
    expect(res.status).toBe(503);
    expect((await res.json()).message).toContain("192.168.0.56:8080");
  });

  it("rejects missing fields with 422 before calling the backend", async () => {
    const res = await login(post({ username: "", password: "" }));

    expect(res.status).toBe(422);
    expect((await res.json()).fieldErrors).toHaveProperty("username");
    expect(verifyCredential).not.toHaveBeenCalled();
  });

  it("rejects a malformed body with 400", async () => {
    const res = await login(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session", async () => {
    const res = await logout();
    expect(res.status).toBe(200);
    expect(clearSession).toHaveBeenCalledOnce();
  });
});
