import { cookies } from "next/headers";
import type { AuthUser } from "@/lib/types";
import { TOKEN_COOKIE, USER_COOKIE, parseUserCookie } from "@/lib/session-shared";

export { TOKEN_COOKIE, USER_COOKIE, parseUserCookie };

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

/** Use in server components that must have a user; middleware normally guarantees it. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("No authenticated user in session");
  return user;
}
