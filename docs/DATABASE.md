# Database

Lunova uses **PostgreSQL** with **Prisma 7** (driver-adapter client, `pg` pool).

## Local development

The dev database is an **isolated, user-owned PostgreSQL cluster** created with
`initdb` — it does **not** touch any system PostgreSQL install and needs no
superuser password from an existing install.

| | |
|---|---|
| Data directory | `~/.lunova/pgdata` |
| Host / port | `127.0.0.1:5433` (localhost only) |
| Superuser role | `lunova` (cluster-local) |
| App role | `lunova_app` (LOGIN, CREATEDB) — owns the databases |
| Databases | `lunova_dev`, `lunova_shadow` (for `prisma migrate dev`) |
| Credentials | generated at setup, stored **only** in `.env` (gitignored) |

### Managing the cluster

```bash
npm run pg:start     # start on :5433 (detached)
npm run pg:status
npm run pg:stop
```

### Schema workflow

```bash
npm run db:migrate            # prisma migrate dev — create + apply a migration
npm run db:generate          # regenerate the client (not automatic in Prisma 7)
npm run db:seed              # reference data (prompts, interests, activity types)
SEED_DEMO=1 npm run db:seed  # + dev-only demo accounts (@demo.lunova.local / "lunova-demo-pass")
npm run db:studio            # Prisma Studio
```

### Recreating the cluster from scratch

```bash
"C:\Program Files\PostgreSQL\17\bin\initdb.exe" -D "%USERPROFILE%\.lunova\pgdata" \
  -U lunova --pwfile=<file-with-password> --auth-host=scram-sha-256 --auth-local=scram-sha-256 -E UTF8 --locale=C
# then append `port = 5433`, `listen_addresses = '127.0.0.1'` to postgresql.auto.conf,
# start it, and: CREATE ROLE lunova_app LOGIN PASSWORD '...' CREATEDB;
#                CREATE DATABASE lunova_dev OWNER lunova_app;
#                CREATE DATABASE lunova_shadow OWNER lunova_app;
# finally set DATABASE_URL / SHADOW_DATABASE_URL in .env and run `npm run db:migrate`.
```

## Production

Point `DATABASE_URL` at a managed PostgreSQL instance and run
`prisma migrate deploy`. Connection pooling is handled by the `pg` pool in
`src/lib/db.ts` (`max: 10`); put a external pooler (PgBouncer / platform pooler)
in front for serverless deployments and set `DATABASE_URL` to the pooled endpoint.
