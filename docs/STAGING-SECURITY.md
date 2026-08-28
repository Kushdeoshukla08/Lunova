# Staging security checklist

Run before the staging URL is shared with anyone. Re-run after any change to
auth, headers, `next.config.ts`, or the proxy. Where a check is "verify on
staging" it can't be fully proven from a dev box.

| # | Control | State | Where / how to verify |
| --- | --- | --- | --- |
| 1 | **HTTPS only** | host-provided | The chosen platform (Fly/Render/Railway) terminates TLS and redirects http→https. `upgrade-insecure-requests` is in the CSP for prod-like. Verify: `curl -I http://staging…` returns a 301 to https. |
| 2 | **Secure cookies** | ✅ code | `auth/session.ts` + `i18n/actions.ts` set `secure` from `isProdLike` (true for `APP_ENV=staging`), all `httpOnly` where they hold anything sensitive, `sameSite=lax`, `path=/`. Verify: DevTools → Application → Cookies shows `Secure` + `HttpOnly` on `lunova_session`. |
| 3 | **Security headers** | ✅ code | `next.config.ts`: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, and `Strict-Transport-Security` (prod-like only). Verify: `curl -I https://staging…` and https://securityheaders.com. |
| 4 | **CSP** | ✅ code | `default-src 'self'`; no `'unsafe-eval'` in prod builds; `object-src 'none'`; `base-uri 'self'`; `frame-ancestors 'none'`; `form-action 'self'`. `script-src` keeps `'unsafe-inline'` (Next's bootstrap; no third-party or user inline scripts ship) — upgrade path to nonce/SRI noted below. Verify: no CSP violations in the console across the core journey. |
| 5 | **CSRF** | ✅ framework + code | Next Server Actions reject cross-origin POSTs (Origin vs Host); `serverActions.allowedOrigins` is pinned to `APP_URL`'s host so a Host-rewriting proxy can't widen it. GET routes are side-effect-free. No cookie-authenticated state-changing GET. |
| 6 | **Rate limiting** | ✅ code (single-instance) | `RATE_RULES` on signup, login (per-IP + per-email), OTP verify/resend, likes (daily + 40/h burst), messages, reports, phone/photo verification. Memory adapter — for multi-instance staging set `REDIS_URL` and add the Redis adapter (`src/lib/rate-limit.ts` TODO). One always-on container is fine for validation. |
| 7 | **Authorization** | ✅ code + tests | Every protected route calls the DAL (`requireUser`/`requireOnboardedUser`/`requireRole`); the proxy is optimistic redirect only. Cross-user access to profiles/conversations/reports/matches is covered by `src/lib/security/adversarial.integration.test.ts` + `abuse.integration.test.ts`. |
| 8 | **Admin protection** | ✅ code + tests | `/admin/*` gated by `requireRole("ADMIN","MODERATOR")` in the layout AND each page/action. A MODERATOR cannot action staff or reverse a ban (docs/SECURITY-AUDIT.md S6–S8). Every moderation action writes an `AuditLog` row in the same transaction. |
| 9 | **Error redaction** | ✅ code | `error.tsx` / `global-error.tsx` show a generic message, no stack. RSC errors surface only a `digest` to the client. `captureError` + the logger redact `email/phone/ip/token/code/body/lat-lng` before writing. Verify: force a 500 on staging, confirm the page and the response body carry no stack or SQL. |
| 10 | **Metrics protection** | ✅ code | `GET /api/metrics` returns 404 unless `METRICS_TOKEN` is set, then requires `Authorization: Bearer <token>`. No per-user data in the payload. Verify: unauthenticated `curl` → 404/401; with the token → Prometheus text only. |
| 11 | **Health endpoint** | ✅ code | `GET /api/health` is unauthenticated by design (LB probe) but returns only `{ok, db, ms}` — no version, no secrets. |
| 12 | **Database access** | staging config | Managed Postgres with `sslmode=require`, not publicly reachable except from the app (platform private networking or IP allowlist). Migrations via `prisma migrate deploy` only. A dedicated app role, not a superuser. |
| 13 | **Storage access** | staging config | Its own bucket. Objects served via `S3_PUBLIC_URL` (CDN) for reads; writes only via the app's credentials. Bucket is **not** world-listable; uploaded media keys are unguessable. Verify: the bucket root returns 403, a known object URL returns 200. |
| 14 | **Secrets** | staging config | All secrets in the host's secret manager, none in the image or the repo. `AUTH_SECRET` is unique to staging. `.env.staging.example` is the only committed staging file and contains no values. |
| 15 | **Adversarial suite** | ✅ where practical | Run `RUN_DB_TESTS=1 npm test` against a copy of the staging schema (they create/tear down their own users). The auth/authz/abuse assertions are environment-independent. |

## Upgrade path (not blockers for staging)

- **Nonce or SRI CSP** to drop `script-src 'unsafe-inline'` — costs static
  rendering (nonce) or rides an experimental flag (SRI). Revisit before
  production if a compliance need appears (docs: Next "Content Security Policy").
- **Redis-backed rate limiting + realtime** once staging runs more than one
  instance.
- **Browser error SDK** for client-side `error.tsx` (currently `console.error`).
- **`report-to` / CSP reporting endpoint** to collect violations from real
  browsers.
