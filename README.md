# Lunova

**Lifestyle-first connection.** Lunova helps people discover meaningful
connections through who they are, what they enjoy, what they listen to, and how
they live — not through how much they swipe.

> Inspired by the strongest interaction principles of Hinge (intentional
> profiles), Bumble (safety & verification), Spotify (music as identity) and
> Strava (activity as a lifestyle signal) — built as **one** coherent product.

## Stack

| | |
|---|---|
| Framework | **Next.js 16** (App Router, `src/`, Turbopack), React 19.2, TypeScript strict |
| Data | **PostgreSQL** + **Prisma 7** (`prisma-client` generator, `pg` driver adapter) |
| Auth | Custom — opaque DB-backed sessions, httpOnly cookies, bcrypt, a Data Access Layer |
| Styling | Tailwind v4 (CSS `@theme` tokens) + a hand-built component library |
| Validation | Zod everywhere (client + server) |
| Tests | Vitest (unit + DB integration), gated by `RUN_DB_TESTS` |

Everything external is behind a provider interface with a local/dev
implementation: **email**, **SMS**, **object storage**, **geocoding**,
**content moderation**, **identity verification**, **rate limiting**. Swap the
implementation, not the call sites.

## Getting started

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET + DATABASE_URL

npm run pg:start              # local dev Postgres cluster (see docs/DATABASE.md)
npm run db:migrate            # apply migrations
npm run db:generate           # generate the Prisma client
SEED_DEMO=1 npm run db:seed   # reference data + demo profiles

npm run dev                   # http://localhost:3000
```

Demo accounts: `maya@ / arjun@ / sol@ / noor@ / admin@ demo.lunova.local`,
password `lunova-demo-pass` (`admin@` has the `ADMIN` role for the Trust &
Safety console at `/admin`).

## Scripts

| | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` / `test:db` | Vitest (unit / + DB integration) |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |
| `npm run db:migrate` / `db:generate` / `db:seed` / `db:studio` | Prisma |
| `npm run pg:start` / `pg:stop` / `pg:status` | local dev Postgres cluster |
| `npm run verify:onboarding` | end-to-end check of the onboarding data layer |

## The core loop

`Landing → Sign up → Onboarding → Build identity → Discover → Understand
compatibility → Like / react → Match → Conversation` — with **music**,
**movement**, **privacy** and **safety** woven into each step.

- **Discovery** is the hero: story-style profiles that read at a glance and
  explain *why* you might connect, in human language.
- **Compatibility** is a modular engine (`src/lib/compatibility/`) — independent
  intent / interest / music / activity / distance / personality signals blended
  into a ranking score. It is a guide, never a prediction.
- **Safety** is first-class: verification, privacy-aware location, and
  block/report/unmatch on every screen — never paywalled. Trust signals,
  reports and moderation history are private and never surfaced as a public
  score.

## Layout

```
src/
  app/                 routes — (marketing) / (auth) / (app) / (admin) groups
  components/          ui/ · onboarding/ · discovery/ · messaging/ · safety/ · admin/ · …
  lib/
    auth/              sessions, DAL, password, tokens, actions
    compatibility/     the engine (pure, tested)
    discovery/  matching/  conversations/  messaging/
    safety/  verification/  moderation/  notifications/  admin/
    providers/         email · sms · storage · geocode
    validation/        Zod schemas
  generated/prisma/    Prisma client (gitignored, regenerate with db:generate)
prisma/                schema · migrations · seed
docs/                  DATABASE.md
```

## Status

The full build order is implemented and exercised end to end: auth · onboarding
· profile · discovery · likes · matching · messaging · music · activity ·
privacy · verification · safety/reporting · notifications · settings · admin
foundation.

Mocked-but-swappable for local dev: email/SMS = console, moderation =
heuristics, identity verification = auto-approve, storage = local disk,
geocoding = a small built-in gazetteer, rate limiting = in-memory. Real-time
message delivery is on navigation/refresh (no socket layer yet).
