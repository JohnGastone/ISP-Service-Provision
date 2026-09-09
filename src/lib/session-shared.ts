import type { AuthUser } from "@/lib/types";

/**
 * Runtime-neutral session helpers — safe to import from middleware (edge),
 * server components and client components alike.
 */

export const TOKEN_COOKIE = process.env.AUTH_COOKIE_NAME || "isp_token";
/** Readable by middleware and the browser; holds no secret, only display/role data. */
export const USER_COOKIE = "isp_user";

export function parseUserCookie(raw: string): AuthUser | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as AuthUser;
    return parsed && typeof parsed.role === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function homeFor(role: string): string {
  return role === "ADMIN" ? "/admin" : "/customer";
}
