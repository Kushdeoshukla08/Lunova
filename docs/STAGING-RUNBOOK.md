# Staging runbook

Get Lunova onto a real HTTPS URL with the **simplest** production-capable
stack. This is for validating the product, not scaling it.

## Architecture (Option A from docs/DEPLOYMENT.md)

```
        ┌─────────────────────────────┐
 users →│  one always-on container     │→ managed Postgres  (Neon / Supabase / RDS)
 HTTPS  │  Next.js standalone server   │→ object storage    (Cloudflare R2 / S3)
        │  (SSE + in-process realtime) │→ Redis  (Upstash)  — optional for 1 instance
        └─────────────────────────────┘
```

One container because SSE + the in-process realtime fan-out fight the
serverless function model (docs/DEPLOYMENT.md). Redis is only needed once there
is more than one instance.

## Pieces to provision (all have free / cheap tiers)

| Piece | Suggested | Gives you |
| --- | --- | --- |
| App host | **Fly.io** (`fly launch` reads the `Dockerfile`), or Render / Railway | the container + TLS + a `*.fly.dev` URL |
| Postgres | **Neon** (branch = `staging`) or Supabase | `DATABASE_URL` with `sslmode=require` |
| Object storage | **Cloudflare R2** (S3-compatible, no egress fees) | `S3_*` vars + a public `S3_PUBLIC_URL` |
| Redis | **Upstash** (skip until >1 instance) | `REDIS_URL` |
| Email | **Resend** (staging API key, staging domain) | verification links that actually arrive |
| SMS | **Twilio** (test credentials, or a low-cap subaccount) | phone verification |
| Errors | **Sentry** (a separate `staging` project) — optional | `SENTRY_DSN` |

Create a **separate Spotify app** for staging later, with redirect URI
`https://<staging-host>/api/music/spotify/callback`.

## First deploy

1. **Repo → host.** Point the host at the GitHub repo, `main` branch. It builds
   the `Dockerfile` (multi-stage, non-root, `output: "standalone"`).
2. **Env.** Set every variable from `.env.staging.example` in the host's secret
   manager. Generate `AUTH_SECRET` fresh: `openssl rand -base64 48`. Set
   `APP_ENV=staging`, `NODE_ENV=production`, `APP_URL=https://<staging-host>`.
   Set `METRICS_TOKEN` to a random string.
3. **Database.** The container runs `prisma migrate deploy` as a release step
   (already in the `Dockerfile` flow / `docker-compose.yml` `migrate` service).
   If your host has no release-phase hook, run once manually:
   `DATABASE_URL=… npx prisma migrate deploy`.
4. **Reference data + personas.**
   ```
   DATABASE_URL=…  npm run db:seed                       # prompts, interests, activity types
   DATABASE_URL=…  APP_ENV=staging SEED_STAGING=1  npm run db:seed:staging
   ```
   The staging seed refuses to run without both `APP_ENV=staging` and
   `SEED_STAGING=1`, so it can never touch production.
5. **Storage.** Create the bucket, set it non-public-listable, put the CDN /
   public base in `S3_PUBLIC_URL`, and confirm `STORAGE_PROVIDER=s3`.
6. **Smoke test.** `curl -I https://<staging-host>/api/health` → 200 `{ok:true}`.
   Then walk the core journey in a browser: sign up (check the email arrives),
   onboard, land in a populated Discovery feed, like a persona, open the
   conversation.
7. **Security pass.** Work through `docs/STAGING-SECURITY.md`. Run
   `curl -I` for headers; open DevTools and confirm `Secure`+`HttpOnly` on the
   session cookie and zero CSP violations across the journey.

## Ongoing

- **Staging tracks `main`.** Every merge that passes CI redeploys staging.
- **Reseed freely.** `SEED_STAGING_RESET=1 npm run db:seed:staging` wipes and
  rebuilds the personas. Nothing in staging is real.
- **Metrics.** Point a scraper at `https://<staging-host>/api/metrics` with the
  bearer token, or just `curl` it. `/admin/metrics` shows product health.
- **Promotion to production** is a separate host with its own everything, fed by
  tagged releases (docs/ENVIRONMENTS.md). Do not reuse a single staging value.

## Rollback

The host keeps previous images — roll back to the last good deploy from its
dashboard. Migrations are additive (`CONTENT_FLAGGED` enum add, nullable
columns); if a migration is bad, restore the Postgres branch/snapshot and
redeploy the previous image.
