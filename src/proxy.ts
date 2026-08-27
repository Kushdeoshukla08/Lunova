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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  // Only guard app routes on *missing* cookie. Redirecting an authed user away
  // from /login is left to those pages (via the DAL) so a stale/invalid cookie
  // can't ping-pong between proxy and page.
  if (!hasSession && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search =
      pathname === "/discover" ? "" : `?next=${encodeURIComponent(pathname)}`;
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
  ],
};
