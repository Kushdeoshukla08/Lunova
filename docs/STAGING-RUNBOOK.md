# Staging runbook

Get Lunova onto a real HTTPS URL for **$0**, for moderated user testing
(docs/USER-TESTING.md). Not built for always-on traffic.

## The free stack (chosen for zero cost)

| Piece | Choice | Notes |
| --- | --- | --- |
| App host | **Render**, free web service, Docker | `*.onrender.com` + HTTPS. **Spins down after ~15 min idle**, cold-starts in ~30–60 s. Fine for scheduled sessions. Config: `render.yaml`. |
| Database | **Neon**, free tier | 0.5 GB, sleeps after 5 min, wakes in ~0.5 s. Reachable from anywhere via its connection string. |
| Object storage | none — `STORAGE_PROVIDER=local` | The free container disk is **ephemeral**: uploads vanish on redeploy. The staging seed regenerates persona photos; testers' uploads are disposable. |
| Email | none — `EMAIL_PROVIDER=console` | During a moderated session the facilitator reads the 6-digit code from the Render logs. |
| SMS | none — `SMS_PROVIDER=console` | Phone verification is optional; testers skip it. |
| Redis | none | Single instance ⇒ in-process realtime + in-memory rate limiting. |
| Errors | none | Structured logs only (Render captures stdout). |

Everything is behind the provider abstractions (docs/PROVIDERS.md), so any of
these can later be swapped for a real vendor by setting env vars — no code change.

## One-time setup

### 1. Neon (database)
1. neon.tech → new project (free). Region near your testers.
2. Copy the **pooled** connection string (has `-pooler` in the host). It already
   includes `?sslmode=require`.

### 2. Seed the database (from your laptop, not Render)
The runtime image doesn't carry `tsx`, so run the seeds locally against Neon:
```bash
export DATABASE_URL='postgresql://…-pooler…/neondb?sslmode=require'
npx prisma migrate deploy          # create the schema
npm run db:seed                    # prompts, interests, activity types
APP_ENV=staging SEED_STAGING=1 npm run db:seed:staging   # the 14 demo personas
```
`db:seed:staging` refuses to run without both `APP_ENV=staging` and
`SEED_STAGING=1`, so it can never touch another database by accident.

### 3. Render (the app)
1. render.com → **New → Blueprint** → connect this GitHub repo. It reads
   `render.yaml` and proposes one web service, `lunova-staging`.
2. When prompted, fill the three secrets (the rest are in `render.yaml`):
   - `AUTH_SECRET` — `openssl rand -base64 48`
   - `DATABASE_URL` — the Neon pooled string from step 1
   - `METRICS_TOKEN` — `openssl rand -base64 24` (guards `/api/metrics`)
3. Deploy. The container applies pending migrations on boot before starting the
   server, so this is a no-op after step 2 and every later deploy carries its
   own schema changes with it. Nothing to configure.
4. Note the assigned URL. If it isn't `https://lunova-staging.onrender.com`,
   update `APP_URL` in the Render env to match, and redeploy (a wrong `APP_URL`
   breaks OG links and the Server-Action origin check).

### 4. Smoke test
```bash
curl -s https://<your-host>/api/health         # {"ok":true,"db":"up",...}
```

Read the whole body, not just `ok`. Two fields say whether the deploy is really
sound, and neither of them affects the status code:

- **`migrations.upToDate`** — `false` means the running image expects a schema
  the database does not have. The app can look fine and still be one index or
  one column short. The container migrates itself on boot, so this should only
  ever be `false` if that failed — check the deploy logs for
  `[entrypoint] MIGRATIONS FAILED`, which prints the reason. A redeploy retries.
  The usual causes are a database that was unreachable during boot, or a
  migration that conflicts with data already in the table.
- **`storage.ready`** — `false` lists the `S3_*` variables that are missing by
  name. With `STORAGE_PROVIDER=local` it is always `true`, and uploads live on
  the container's ephemeral disk: they vanish on every redeploy, which is why
  seeded persona photos 404 after a deploy.
Then in a browser: sign up → (read the code from Render logs) → verify → onboard
→ land in a populated Discovery feed → like a persona → open the conversation.

### 5. Security pass
Work through **docs/STAGING-SECURITY.md**. Quick checks:
```bash
curl -sI https://<your-host>/           # CSP, HSTS, X-Frame-Options, COOP present
curl -s  https://<your-host>/api/metrics            # 404 (no token)
curl -s https://<your-host>/api/metrics -H "Authorization: Bearer $METRICS_TOKEN" | head
```
In DevTools → Application → Cookies: `lunova_session` is `Secure` + `HttpOnly`.
Walk the journey with the console open — zero CSP violations.

## Ongoing

- **Push to `main` → Render redeploys** (`autoDeploy: true`).
- **Reseed anytime** from your laptop:
  `DATABASE_URL=… SEED_STAGING_RESET=1 APP_ENV=staging SEED_STAGING=1 npm run db:seed:staging`.
- **Read product health** at `https://<your-host>/admin/metrics` (sign in as an
  ADMIN — create one by setting `role='ADMIN'` on your own row in Neon, or add a
  seeded admin).
- **Cold start**: hit the URL ~1 min before a session so the first tester
  doesn't wait on the spin-up.

## Upgrading later (still cheap, not free)

- Persistent storage: Cloudflare R2 free tier (10 GB, no egress) →
  `STORAGE_PROVIDER=s3` + `S3_*`.
- Real email: Resend free tier (100/day) + a sending subdomain →
  `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`.
- Always-on app: Render Starter ($7/mo) removes the spin-down.
- Production is a **separate** Render service + Neon project, fed by tagged
  releases (docs/ENVIRONMENTS.md). Never reuse a staging secret.

## Rollback

Render keeps prior deploys — "Rollback" in the dashboard. Migrations so far are
additive (an enum value, nullable columns); if one is bad, restore the Neon
branch/snapshot and roll the Render deploy back.
