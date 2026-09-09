import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";
import { SPRING_API_URL } from "@/lib/api";
import { getToken } from "@/lib/session";

export async function POST() {
  const token = await getToken();

  // Best-effort backend invalidation — the local session is cleared regardless.
  if (token) {
    try {
      await fetch(`${SPRING_API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    } catch {
      /* ignore — the cookie is what gates this app */
    }
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
