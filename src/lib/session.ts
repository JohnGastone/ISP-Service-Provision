import { cookies } from "next/headers";
import type { AuthUser } from "@/lib/types";
import { AUTH_COOKIE, USER_COOKIE, parseUserCookie } from "@/lib/session-shared";

export { AUTH_COOKIE, USER_COOKIE, parseUserCookie };

const SECURE = process.env.COOKIE_SECURE === "true";
const MAX_AGE = 60 * 60 * 8; // 8 hours

/** `credential` is the base64 of "username:password" for the Basic header. */
export async function setSession(credential: string, user: AuthUser) {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, credential, {
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
  jar.delete(AUTH_COOKIE);
  jar.delete(USER_COOKIE);
}

export async function getCredential(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const raw = jar.get(USER_COOKIE)?.value;
  if (!raw) return null;
  return parseUserCookie(raw);
}
