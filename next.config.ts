import type { NextConfig } from "next";

/**
 * Security headers applied to every response. CSP is intentionally strict;
 * loosen per-route only with a documented reason.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Self-contained server bundle for the production container (see docs/DEPLOYMENT.md).
  output: "standalone",
  // Pin the workspace root so Turbopack doesn't walk up to a stray lockfile in $HOME.
  turbopack: { root: import.meta.dirname },
  experimental: {
    // Server Actions are same-origin only; list extra trusted origins here if needed.
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: {
    // Local object-store previews + future CDN host. Tighten in production.
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    qualities: [50, 75, 90],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
