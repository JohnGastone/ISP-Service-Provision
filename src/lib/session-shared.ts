import type { AuthUser } from "@/lib/types";

/**
 * Runtime-neutral session helpers — safe to import from middleware (edge),
 * server components and client components alike.
 */

/**
 * Holds the base64 `user:pass` for the API's HTTP Basic auth. The backend has
 * no token endpoint, so the credential itself must be replayed on every call.
 * It is kept httpOnly so browser JavaScript can never read it.
 */
export const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || "isp_auth";

/** Readable by middleware and the browser; holds no secret, only display data. */
export const USER_COOKIE = "isp_user";

export function parseUserCookie(raw: string): AuthUser | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as AuthUser;
    return parsed && typeof parsed.role === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/** Only the admin area exists; every signed-in user lands there. */
export function homeFor(_role: string): string {
  return "/admin";
}
