import { NextResponse } from "next/server";
import { ApiRequestError, SPRING_API_URL, handle } from "@/lib/api";
import { setSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";
import type { LoginResponse } from "@/lib/types";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Malformed request body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Check the details you entered", fieldErrors: flatten(parsed.error.issues) },
      { status: 422 },
    );
  }

  try {
    const res = await fetch(`${SPRING_API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });

    const data = await handle<LoginResponse>(res);
    if (!data?.token || !data?.user) {
      return NextResponse.json(
        { message: "Unexpected response from the authentication service" },
        { status: 502 },
      );
    }

    await setSession(data.token, data.user);
    // The token stays server-side; the browser only learns who it is signed in as.
    return NextResponse.json({ user: data.user });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      const message =
        error.status === 401 || error.status === 403
          ? "Incorrect email or password"
          : error.message;
      return NextResponse.json({ message }, { status: error.status });
    }
    return NextResponse.json(
      { message: "Cannot reach the authentication service. Is the API running?" },
      { status: 503 },
    );
  }
}

function flatten(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_";
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
