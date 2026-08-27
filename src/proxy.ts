import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic routing only — NOT authorization. It checks for the presence of the
 * session cookie to avoid a pointless render, then redirects. Every protected
 * route still does the real check server-side via the DAL (`requireUser`).
 */
const SESSION_COOKIE = "lunova_session";

const PROTECTED = [
  "/discover",
  "/connections",
  "/activity",
  "/profile",
  "/settings",
  "/onboarding",
  "/verify",
  "/account",
];
const AUTH_ONLY = ["/login", "/signup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/discover" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_ONLY.some((p) => pathname === p)) {
    const url = request.nextUrl.clone();
    url.pathname = "/discover";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/discover/:path*",
    "/connections/:path*",
    "/activity/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
    "/verify/:path*",
    "/account/:path*",
    "/login",
    "/signup",
  ],
};
