#!/bin/sh
set -e

# Opt-in: run migrations before serving. For hosts without a release/pre-deploy
# hook (e.g. Render's free tier). Call the CLI's real entry directly — the
# npm-generated `.bin/prisma` shim is a symlink that Docker flattens into a
# broken file copy (`Cannot find module './cli.js'`). `node_modules/prisma` is
# copied whole, so `build/index.js` + its wasm siblings resolve correctly.
# A migrate failure is logged but does NOT stop the server from starting — a
# booted app whose /api/health reports "migrations behind" is far easier to
# diagnose than a crash loop. Leave RUN_MIGRATIONS_ON_START unset where the
# platform runs migrations separately (docker-compose does).
if [ "$RUN_MIGRATIONS_ON_START" = "1" ]; then
  echo "[entrypoint] prisma migrate deploy"
  set +e
  node node_modules/prisma/build/index.js migrate deploy
  code=$?
  set -e
  [ "$code" -ne 0 ] && echo "[entrypoint] WARNING: migrate deploy exited $code — starting server anyway; check /api/health"
fi

# Run whatever command was passed (CMD), defaulting to the Next server.
if [ "$#" -eq 0 ]; then
  exec node server.js
fi
exec "$@"
