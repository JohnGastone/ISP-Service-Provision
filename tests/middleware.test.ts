import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { AUTH_COOKIE, USER_COOKIE } from "@/lib/session-shared";
import type { AuthUser } from "@/lib/types";

const ADMIN: AuthUser = { username: "admin", fullName: "admin", role: "ADMIN" };
const CUSTOMER: AuthUser = {
  username: "ops@acme.co.tz",
  fullName: "ops@acme.co.tz",
  role: "CUSTOMER",
};

function request(path: string, user?: AuthUser, opts: { credential?: string } = {}) {
  const req = new NextRequest(`http://localhost:3000${path}`);
  if (user) {
    req.cookies.set(USER_COOKIE, encodeURIComponent(JSON.stringify(user)));
    req.cookies.set(AUTH_COOKIE, opts.credential ?? "YWRtaW46eA==");
  }
  return req;
}

function location(res: Response) {
  return new URL(res.headers.get("location")!).pathname;
}

describe("unauthenticated visitors", () => {
  it.each(["/admin", "/admin/customers", "/customer", "/customer/requests"])(
    "redirects %s to the login page",
    (path) => {
      const res = middleware(request(path));
      expect(res.status).toBe(307);
      expect(location(res)).toBe("/login");
    },
  );

  it("preserves the intended destination so login can return there", () => {
    const res = middleware(request("/admin/requests"));
    const url = new URL(res.headers.get("location")!);
    expect(url.searchParams.get("next")).toBe("/admin/requests");
  });

  it("does not add a next param for the root path", () => {
    const res = middleware(request("/"));
    const url = new URL(res.headers.get("location")!);
    expect(url.searchParams.get("next")).toBeNull();
  });

  it("lets the login page render", () => {
    const res = middleware(request("/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("treats a user cookie without its credential cookie as signed out", () => {
    const req = new NextRequest("http://localhost:3000/admin");
    req.cookies.set(USER_COOKIE, encodeURIComponent(JSON.stringify(ADMIN)));
    // No AUTH_COOKIE — a forged display cookie alone must not grant access.
    const res = middleware(req);
    expect(location(res)).toBe("/login");
  });

  it("treats a tampered user cookie as signed out", () => {
    const req = new NextRequest("http://localhost:3000/admin");
    req.cookies.set(USER_COOKIE, "garbage");
    req.cookies.set(AUTH_COOKIE, "YWRtaW46eA==");
    expect(location(middleware(req))).toBe("/login");
  });
});

describe("role separation", () => {
  it("keeps a customer out of the admin area", () => {
    const res = middleware(request("/admin/customers", CUSTOMER));
    expect(res.status).toBe(307);
    expect(location(res)).toBe("/customer");
  });

  it("keeps an admin out of the customer portal", () => {
    const res = middleware(request("/customer/requests", ADMIN));
    expect(res.status).toBe(307);
    expect(location(res)).toBe("/admin");
  });

  it("lets each role reach its own area", () => {
    expect(middleware(request("/admin", ADMIN)).headers.get("location")).toBeNull();
    expect(middleware(request("/customer", CUSTOMER)).headers.get("location")).toBeNull();
  });
});

describe("signed-in redirects", () => {
  it("sends a signed-in user away from the login page to their home", () => {
    expect(location(middleware(request("/login", ADMIN)))).toBe("/admin");
    expect(location(middleware(request("/login", CUSTOMER)))).toBe("/customer");
  });

  it("routes the root path to the role's home", () => {
    expect(location(middleware(request("/", ADMIN)))).toBe("/admin");
    expect(location(middleware(request("/", CUSTOMER)))).toBe("/customer");
  });
});
