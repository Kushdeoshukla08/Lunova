/**
 * Resolving the caller's IP address behind a reverse proxy.
 *
 * This matters because the IP keys the per-IP rate limits on signup and login.
 * If an attacker can choose the value, they can rotate it and the limit stops
 * existing — which is exactly what happens when you trust `X-Real-IP` or the
 * leftmost `X-Forwarded-For` entry: both are just request headers the client
 * writes.
 *
 * A proxy *appends* the peer address it saw. So with N trusted proxies between
 * the internet and the app, the last N entries were written by infrastructure
 * and everything to their left is attacker-supplied. The Nth-from-the-right
 * entry is therefore the first value the attacker could not forge.
 *
 * No `server-only` import: pure header parsing, unit-tested directly.
 */

export const UNKNOWN_IP = "unknown";

export interface ClientIpOptions {
  /**
   * How many trusted proxies sit in front of the app. 1 for Render/Fly/Heroku
   * and most single-load-balancer setups; 2 when a CDN fronts the platform.
   * 0 means the app is exposed directly and no forwarding header is believed.
   */
  trustedProxyHops?: number;
}

/**
 * Reduce the spellings of one address to a single value, so a client cannot get
 * a fresh rate-limit allowance just by changing how it writes its own IP.
 * Returns null for anything that is not plausibly an address — a garbage header
 * must never become a bucket key.
 */
function canonicalIp(raw: string): string | null {
  let value = raw.trim();
  if (!value || value.length > 45) return null;

  // Bracketed IPv6, optionally with a port: [2001:db8::1]:443
  const bracketed = value.match(/^\[([0-9a-fA-F:.]+)\](?::\d{1,5})?$/);
  if (bracketed) value = bracketed[1]!;
  // IPv4 with a port: 203.0.113.7:44321
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$/.test(value)) value = value.split(":")[0]!;

  value = value.toLowerCase();

  // An IPv4-mapped IPv6 address is the same client as the bare IPv4 one.
  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) value = mapped[1]!;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return value.split(".").every((o) => Number(o) <= 255) ? value : null;
  }
  if (/^[0-9a-f:]+$/.test(value) && value.includes(":")) return value;
  return null;
}

/**
 * The client IP to key rate limits on, or `UNKNOWN_IP`.
 *
 * `UNKNOWN_IP` is a single shared bucket on purpose: unattributable traffic
 * should contend with itself rather than each get its own fresh allowance.
 */
export function clientIpFrom(
  headers: { get(name: string): string | null },
  { trustedProxyHops = 1 }: ClientIpOptions = {},
): string {
  if (trustedProxyHops <= 0) return UNKNOWN_IP;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    // Count in from the right: those entries were written by our own proxies.
    const index = parts.length - trustedProxyHops;
    const candidate = parts[index];
    if (candidate) return canonicalIp(candidate) ?? UNKNOWN_IP;
    // Fewer entries than hops means the header was truncated or spoofed short;
    // the leftmost value is then the only one present and is not trustworthy.
    return UNKNOWN_IP;
  }

  // No X-Forwarded-For at all. `X-Real-IP` is only meaningful if a proxy set it,
  // and a proxy that sets it also sets X-Forwarded-For — so reaching here means
  // the request did not come through the expected path.
  return UNKNOWN_IP;
}
