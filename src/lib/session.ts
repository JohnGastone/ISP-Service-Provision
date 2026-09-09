import "server-only";
import { cookies } from "next/headers";
import type { AuthUser } from "@/lib/types";

export const TOKEN_COOKIE = process.env.AUTH_COOKIE_NAME || "isp_token";
/** Readable by middleware and the browser; holds no secret, only display/role data. */
export const USER_COOKIE = "isp_user";

const SECURE = process.env.COOKIE_SECURE === "true";
const MAX_AGE = 60 * 60 * 8; // 8 hours

export async function setSession(token: string, user: AuthUser) {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE,
    path: "/",
    maxAge: MAX_AGE,
  });
  jar.set(USER_COOKIE, encodeURIComponent(JSON.stringify(user)), {
    httpOnly: false,
    sameSite: "lax",
    secure: SECURE,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(USER_COOKIE);
}

export async function getToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(TOKEN_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const raw = jar.get(USER_COOKIE)?.value;
  if (!raw) return null;
  return parseUserCookie(raw);
}

export function parseUserCookie(raw: string): AuthUser | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as AuthUser;
    return parsed && typeof parsed.role === "string" ? parsed : null;
  } catch {
    return null;
  }
}
