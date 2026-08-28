# Environments

Three tiers, fully separated. The rule: **staging data must never reach
production, and production credentials must never be used anywhere else.**

| | development | staging | production |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | `production` | `production` |
| `APP_ENV` | `development` | `staging` | `production` |
| Where it runs | your machine | one small always-on container | the real host |
| `APP_URL` | `http://localhost:3000` | `https://staging.lunova.app` | `https://lunova.app` |
| Database | local `initdb` cluster on :5433 | its own managed Postgres | its own managed Postgres |
| Redis | none (in-process) | its own instance | its own instance |
| Object storage | `.uploads/` on disk | its own bucket | its own bucket |
| Email / SMS | console (printed) | real provider, **staging keys** | real provider, prod keys |
| Spotify OAuth | n/a | its own app, staging redirect URI | its own app, prod redirect URI |
| Secrets | gitignored `.env` | staging host secret manager | prod host secret manager |
| Demo personas | `npm run db:seed` | `npm run db:seed:staging` | **never seeded** |
| Secure cookies / HSTS | off | on | on |
| `/api/metrics` | off unless `METRICS_TOKEN` | on, token-gated | on, token-gated |

## What `APP_ENV` changes in code

`src/lib/env.ts` exports `isProdLike` (staging ∨ production) and `isProduction`:

- **Session + i18n cookies** get `Secure` when `isProdLike` (`auth/session.ts`,
  `i18n/actions.ts`).
- **CSP / HSTS / `upgrade-insecure-requests`** switch on for prod-like in
  `next.config.ts` (HSTS is scoped out of dev so it can't pin a dev machine).
- **Log level** defaults to `info` for `NODE_ENV=production` (both tiers), `debug` locally.
- **Staging seed** (`prisma/seed-staging.ts`) refuses to run unless
  `APP_ENV=staging` **and** `SEED_STAGING=1`.
- **`/api/dev/*`** routes 404 unless `NODE_ENV=development`.

## Never cross the streams

- Don't point a local `.env` at a staging or production database, bucket, or
  provider key. If you need realistic data locally, run `npm run db:seed`.
- Don't copy `AUTH_SECRET` between tiers — a leaked dev secret must not grant
  anything on staging or prod. Generate a fresh one per tier:
  `openssl rand -base64 48`.
- Staging and production must use **different** Spotify/OAuth apps; a redirect
  URI mismatch is the safety net if they're ever confused.
- The staging database may be wiped and reseeded at any time. Nothing in it is
  real. Production migrations run via `prisma migrate deploy` only.

## Promotion flow

```
feature branch ──PR──▶ main ──CI green──▶ deploy to staging (automatic)
                                              │
                                    manual QA + user testing
                                              │
                                       tag a release ──▶ deploy to production
```

`main` is always deployable. Staging tracks `main`. Production tracks tagged
releases. See `.github/workflows/ci.yml` and docs/STAGING-RUNBOOK.md.
