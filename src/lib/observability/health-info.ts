/**
 * Safe, secret-free environment identity for the /api/health probe.
 *
 * NOTHING here may ever expose a credential: not DATABASE_URL, not the DB
 * username or password, not AUTH_SECRET, not METRICS_TOKEN. Only inert
 * identity — the commit that's running, the deploy tier, and the DB *host +
 * database name* (which are not secrets; access still requires auth).
 */

/** Where the build/commit SHA can come from, in priority order. */
export function resolveBuildCommit(
  source: Record<string, string | undefined> = process.env,
): string {
  const candidate =
    source.BUILD_COMMIT ||
    source.RENDER_GIT_COMMIT || // Render injects this automatically
    source.GIT_COMMIT_SHA ||
    source.SOURCE_COMMIT ||
    source.VERCEL_GIT_COMMIT_SHA ||
    source.GITHUB_SHA ||
    "";
  return candidate.trim() || "unknown";
}

export interface DatabaseIdentity {
  /** Hostname only — no port creds, no query string. */
  host: string;
  /** Database name (the URL path), no leading slash. */
  name: string;
}

/**
 * Reduce a Postgres connection URL to just `{ host, name }`. Drops the scheme,
 * username, password, port and every query parameter (some providers pass
 * tokens there). Returns null if the value can't be parsed as a URL.
 */
export function sanitizeDatabaseUrl(
  raw: string | undefined | null,
): DatabaseIdentity | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const name = decodeURIComponent(u.pathname.replace(/^\/+/, "")) || "(none)";
    return { host: u.hostname || "(unknown)", name };
  } catch {
    return null;
  }
}
