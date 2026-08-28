import type { NextConfig } from "next";

/**
 * `next.config.ts` runs before the validated `@/lib/env` module (which is
 * `server-only`), so read raw `process.env` here.
 */
const APP_ENV = process.env.APP_ENV ?? "development";
const IS_DEV = process.env.NODE_ENV !== "production";
const PROD_LIKE = APP_ENV === "staging" || APP_ENV === "production";

const APP_ORIGIN = (() => {
  try {
    return new URL(process.env.APP_URL ?? "http://localhost:3000").host;
  } catch {
    return "localhost:3000";
  }
})();

/**
 * Content Security Policy. Header-based (no per-request nonce) so the marketing
 * pages stay statically rendered and CDN-cacheable — the first impression has to
 * be fast (docs/PERFORMANCE.md). The app ships no third-party scripts and no
 * user-controlled inline scripts, so the residual risk of `script-src
 * 'unsafe-inline'` is low; `'unsafe-eval'` is dev-only (React uses it for
 * server-stack reconstruction). Upgrade path to nonce/SRI CSP is noted in
 * docs/STAGING-SECURITY.md.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${IS_DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  ...(PROD_LIKE ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), browsing-topics=()",
  },
  // HSTS only matters over HTTPS; harmless on http://localhost but scoped to
  // real deployments to avoid pinning a dev machine.
  ...(PROD_LIKE
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Self-contained server bundle for the production container (see docs/DEPLOYMENT.md).
  output: "standalone",
  // Pin the workspace root so Turbopack doesn't walk up to a stray lockfile in $HOME.
  turbopack: { root: import.meta.dirname },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
      // Server Actions reject cross-origin POSTs by comparing Origin to Host.
      // The app's own origin is always allowed; this pins it explicitly so a
      // reverse proxy that rewrites Host can't widen it.
      allowedOrigins: [APP_ORIGIN],
    },
  },
  images: {
    // Local object-store previews + S3/CDN host in staging/production.
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    qualities: [50, 75, 90],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
