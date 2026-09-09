import { NextResponse } from "next/server";
import { SPRING_API_URL } from "@/lib/api";
import { getCredential } from "@/lib/session";

/**
 * Forwards `/api/proxy/<spring path>` to the Spring Boot API with the Basic
 * credential from the httpOnly cookie. Client components use this so the
 * credential is never exposed to browser JavaScript, and because the call to
 * Spring happens server-side the backend needs no CORS configuration.
 */
async function forward(request: Request, path: string[]) {
  const credential = await getCredential();
  if (!credential) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const incoming = new URL(request.url);
  const target = `${SPRING_API_URL}/${path.join("/")}${incoming.search}`;

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const body = hasBody ? await request.text() : undefined;

  let res: Response;
  try {
    res = await fetch(target, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${credential}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body || undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(Number(process.env.API_TIMEOUT_MS) || 6000),
    });
  } catch (error) {
    console.error(`[proxy] ${method} ${target} failed:`, error);
    return NextResponse.json(
      { detail: `Cannot reach the API service at ${SPRING_API_URL}` },
      { status: 503 },
    );
  }

  const text = await res.text();
  return new NextResponse(text || null, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Ctx) {
  return forward(request, (await params).path);
}
export async function POST(request: Request, { params }: Ctx) {
  return forward(request, (await params).path);
}
export async function PUT(request: Request, { params }: Ctx) {
  return forward(request, (await params).path);
}
export async function PATCH(request: Request, { params }: Ctx) {
  return forward(request, (await params).path);
}
export async function DELETE(request: Request, { params }: Ctx) {
  return forward(request, (await params).path);
}
