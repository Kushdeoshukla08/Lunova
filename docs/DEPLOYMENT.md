# Deployment

## Architecture comparison

Lunova today is **one long-running Node process** that holds Server-Sent-Event
connections and an in-process realtime fan-out. That single fact drives the
choice.

| | **A. Composed** (container + managed pieces) | **B. Integrated platform** (e.g. Vercel) |
|---|---|---|
| App runtime | One always-on container (Fly.io / Render / Railway / VPS) | Serverless functions + edge |
| Postgres | Neon / Supabase / RDS | Platform Postgres (Neon under the hood) |
| Media | Cloudflare R2 or AWS S3 | Platform Blob |
| Cache / pub-sub | Upstash Redis (added when >1 instance) | Platform KV (Upstash) |
| **Realtime (SSE)** | **Works natively** — a persistent process holds the streams | **Fights the platform** — function max-duration kills long streams; in-process fan-out never spans invocations. Needs a managed socket service (Ably/Pusher) + rewrite |
| Cost at low scale | Predictable (~$5–25/mo container + free-tier Postgres/R2) | Free to start, but egress + function-GB-seconds get spiky |
| Latency | One region to start; add regions later | Global edge for static; dynamic still hits one DB region |
| Scalability | Scale the container vertically, then horizontally once the Redis adapters are wired | Auto-scales functions, but you inherit the realtime problem |
| Developer experience | Standard Docker; `next build` + `next start` | Excellent for plain Next.js; worse once you need a stateful process |
| Operational complexity | You manage one container + wire 2–3 managed services | Almost none — until the realtime workaround |
| Security | Standard; secrets in the platform's secret store | Same |
| Migration difficulty | Portable — it's just a container + Postgres | Lock-in around Blob/KV/edge middleware |

### Decision — **Option A, minimal footprint**

Start with **one app container + one managed Postgres + one object-storage
bucket**. Nothing else on day one:

- `RealtimeProvider` = in-process (correct for a single instance).
- `RateLimiter` = in-memory (correct for a single instance).
- `MediaStorageProvider` = S3/R2 with signed URLs.

**Upgrade path (documented, not built):** when a second instance is needed, add
the **Upstash Redis** adapters for `RealtimeProvider` (pub/sub) and
`RateLimiter` (sorted-set window) — same interfaces, no feature-code changes —
and put the container behind a load balancer with sticky-less routing (SSE
reconnects and re-syncs from the DB, so stickiness is not required).

Do **not** pre-build multi-region, read replicas, or a queue system. Early
global growth is served by one well-chosen Postgres region + a CDN in front of
media and static assets.

## Runtime shape

```
            ┌────────────┐         ┌──────────────┐
  client ── │  CDN / LB  │ ─────── │ Lunova (Node)│ ── Postgres (managed, 1 region)
            └────────────┘  HTTPS  │  next start  │ ── Object storage (S3/R2, signed URLs)
                    │              │  + SSE       │ ── (later) Redis: realtime + rate-limit
              static + media       └──────────────┘ ── Email / SMS / IDV / moderation providers
```

- **Health check:** `GET /api/health` → `200 {"ok":true}` (checks DB round-trip).
  Point the platform's health probe at it.
- **Migrations:** run `npm run db:migrate:deploy` as a release/pre-deploy step,
  never at container start (avoids races across rolling deploys).
- **Build:** `next.config.ts` sets `output: "standalone"` — the Docker image
  copies `.next/standalone` + `.next/static` + `public` only.
- **Process:** `node server.js` (from the standalone output). One process,
  `NODE_ENV=production`.

## Container

`Dockerfile` (multi-stage) and `.dockerignore` are in the repo root.
`docker compose up` runs the production image + a local Postgres for a
prod-like smoke test.

```bash
docker build -t lunova .
docker run --rm -p 3000:3000 --env-file .env.production lunova
```

## Environment

Every variable is documented in `.env.example`. Production must set at least:

| Variable | Notes |
|---|---|
| `NODE_ENV=production` | |
| `APP_URL` | Public origin, e.g. `https://lunova.app` — used for links & OG |
| `AUTH_SECRET` | 48+ random bytes. `openssl rand -base64 48` |
| `DATABASE_URL` | Managed Postgres, pooled endpoint if serverless-adjacent |
| `STORAGE_PROVIDER=s3` + `S3_*` | Bucket, region, keys, endpoint (R2 needs `S3_ENDPOINT`) |
| `EMAIL_PROVIDER` + creds | See "Real providers" in the roadmap |
| `SMS_PROVIDER` + creds | Phone verification |
| `MODERATION_PROVIDER` + key | Text/image moderation |
| `IDV_PROVIDER` + key | Photo / identity verification (returns a result, not documents) |
| `REDIS_URL` | Only when running >1 instance |

**Never commit a real `.env*`.** `.gitignore` already excludes `.env*` except
`.env.example`. Put production values in the platform's secret manager.

## Pre-launch checklist

- [ ] `AUTH_SECRET` is unique and not the dev value.
- [ ] `DATABASE_URL` points at managed Postgres; `npm run db:migrate:deploy` run.
- [ ] `STORAGE_PROVIDER=s3` with a private bucket + signed reads (see SECURITY-AUDIT S9).
- [ ] Reverse proxy overwrites `x-real-ip` / `x-forwarded-for` (see SECURITY-AUDIT S6).
- [ ] HTTPS everywhere; HSTS is already sent by `next.config.ts` headers.
- [ ] `/styleguide` and `/api/dev/*` are dev-only — confirm they 404 in prod
      (`api/dev/*` self-guards; consider stripping `/styleguide`).
- [ ] Health probe → `/api/health`.
- [ ] Backups enabled on Postgres; object storage lifecycle rules for orphans.
