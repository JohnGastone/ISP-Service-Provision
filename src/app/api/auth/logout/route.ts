import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function POST() {
  // HTTP Basic has no server-side session to invalidate — dropping the cookie
  // is the whole of signing out.
  await clearSession();
  return NextResponse.json({ ok: true });
}
