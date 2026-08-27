import { NextResponse, type NextRequest } from "next/server";

/**
 * Clears a stale/invalid session cookie, then bounces to /login. The DAL sends
 * users here (instead of straight to /login) when a cookie is present but no
 * longer resolves to a live session, so nothing can loop on it.
 */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = next && next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : "";
  const res = NextResponse.redirect(url);
  res.cookies.delete("lunova_session");
  return res;
}
