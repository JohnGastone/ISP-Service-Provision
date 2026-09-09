import { NextResponse, type NextRequest } from "next/server";
import { TOKEN_COOKIE, USER_COOKIE, homeFor, parseUserCookie } from "@/lib/session-shared";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const rawUser = request.cookies.get(USER_COOKIE)?.value;
  const user = rawUser ? parseUserCookie(rawUser) : null;
  const signedIn = Boolean(token && user);

  // Already signed in — bounce away from the login screen to the right home.
  if (pathname === "/login") {
    return signedIn ? NextResponse.redirect(new URL(homeFor(user!.role), request.url)) : NextResponse.next();
  }

  if (!signedIn) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/admin") && user!.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/customer", request.url));
  }

  if (pathname.startsWith("/customer") && user!.role !== "CUSTOMER") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(homeFor(user!.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, the API routes and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
