#!/bin/sh
set -e

# ─── Migrations ──────────────────────────────────────────────────────────────
# Applied on every boot, by default.
#
# The alternative would be a release hook, but Render's free tier has neither a
# Shell nor a pre-deploy command, so the container is the only place migrations
# can run. `migrate deploy` is forward-only and idempotent: on an already-current
# database it applies nothing, and if two containers start together Prisma's
# advisory lock serialises them.
#
# Call the CLI's real entry point — the npm-generated `.bin/prisma` shim is a
# symlink that Docker flattens into a broken file copy (`Cannot find module
# './cli.js'`). The modules it loads are staged into the image by
# scripts/migrator-deps.mjs, and scripts/migrator-deps.test.ts proves that set
# is complete.
#
# Set MIGRATE_ON_START=0 where something else owns migrations (docker-compose
# runs them as a separate one-shot command).
if [ "$MIGRATE_ON_START" = "0" ]; then
  echo "[entrypoint] MIGRATE_ON_START=0 — skipping migrations"
else
  echo "[entrypoint] applying database migrations"
  set +e
  node node_modules/prisma/build/index.js migrate deploy
  code=$?
  set -e
  if [ "$code" -ne 0 ]; then
    # Deliberately not fatal. A booted app whose /api/health reports
    # "migrations.upToDate: false" can be diagnosed from outside; a crash loop
    # on a host with no shell access cannot.
    echo "[entrypoint] ================================================================"
    echo "[entrypoint] MIGRATIONS FAILED (exit $code) — starting the server anyway."
    echo "[entrypoint] The database is behind the code. /api/health will report"
    echo "[entrypoint] migrations.upToDate: false until this is resolved."
    echo "[entrypoint] ================================================================"
  else
    echo "[entrypoint] migrations up to date"
  fi
fi

# Run whatever command was passed (CMD), defaulting to the Next server.
if [ "$#" -eq 0 ]; then
  exec node server.js
fi
exec "$@"
