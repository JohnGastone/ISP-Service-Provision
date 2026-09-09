import { NextResponse } from "next/server";
import {
  ApiRequestError,
  ApiUnreachableError,
  SPRING_API_URL,
  verifyCredential,
} from "@/lib/api";
import { setSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";
import type { AuthUser } from "@/lib/types";

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

  const { username, password } = parsed.data;
  // The API uses HTTP Basic on every call, so the credential is what we store.
  const credential = Buffer.from(`${username}:${password}`, "utf8").toString("base64");

  try {
    const principal = await verifyCredential(credential);

    // The API reports `role` directly; `admin` is the fallback for older builds.
    const role = principal.role ?? (principal.admin ? "ADMIN" : "CUSTOMER");

    const user: AuthUser = {
      username: principal.username,
      fullName: principal.username,
      role,
    };

    await setSession(credential, user);
    // The credential stays in the httpOnly cookie; only display data is returned.
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      const message =
        error.status === 401 || error.status === 403
          ? "Incorrect username or password"
          : error.message;
      return NextResponse.json({ message }, { status: error.status });
    }
    // Naming the host it tried turns "is it running?" into something checkable.
    const detail =
      error instanceof ApiUnreachableError
        ? ` (${error.message})`
        : ` (target: ${SPRING_API_URL})`;

    console.error("[auth/login] backend unreachable:", error);

    return NextResponse.json(
      { message: `Cannot reach the API service${detail}` },
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
