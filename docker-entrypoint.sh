#!/bin/sh
set -e

# Opt-in: run migrations before serving. For hosts without a release/pre-deploy
# hook (e.g. Render's free tier). `prisma migrate deploy` is idempotent and safe
# to run on every boot. Leave RUN_MIGRATIONS_ON_START unset where the platform
# runs migrations separately (docker-compose does, via its own `migrate` service).
if [ "$RUN_MIGRATIONS_ON_START" = "1" ]; then
  echo "[entrypoint] prisma migrate deploy"
  node_modules/.bin/prisma migrate deploy
fi

# Run whatever command was passed (CMD), defaulting to the Next server.
if [ "$#" -eq 0 ]; then
  exec node server.js
fi
exec "$@"
