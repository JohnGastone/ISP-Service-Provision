import { describe, expect, it } from "vitest";
import { AUTH_COOKIE, USER_COOKIE, homeFor, parseUserCookie } from "@/lib/session-shared";
import type { AuthUser } from "@/lib/types";

describe("homeFor", () => {
  it("sends admins to the admin area and customers to their portal", () => {
    expect(homeFor("ADMIN")).toBe("/admin");
    expect(homeFor("CUSTOMER")).toBe("/customer");
  });

  it("treats any unrecognised role as a customer, the lower privilege", () => {
    expect(homeFor("SOMETHING_ELSE")).toBe("/customer");
  });
});

describe("parseUserCookie", () => {
  const user: AuthUser = { username: "admin", fullName: "admin", role: "ADMIN" };

  it("round-trips the encoded cookie value", () => {
    const encoded = encodeURIComponent(JSON.stringify(user));
    expect(parseUserCookie(encoded)).toEqual(user);
  });

  it("returns null for malformed JSON rather than throwing", () => {
    expect(parseUserCookie("not-json")).toBeNull();
    expect(parseUserCookie("%7Bbroken")).toBeNull();
    expect(parseUserCookie("")).toBeNull();
  });

  it("returns null when the payload has no role, so it cannot grant access", () => {
    expect(parseUserCookie(encodeURIComponent(JSON.stringify({ username: "x" })))).toBeNull();
    expect(parseUserCookie(encodeURIComponent(JSON.stringify(null)))).toBeNull();
  });
});

describe("cookie names", () => {
  it("keeps the credential and display cookies separate", () => {
    expect(AUTH_COOKIE).not.toBe(USER_COOKIE);
    expect(USER_COOKIE).toBe("isp_user");
  });
});
