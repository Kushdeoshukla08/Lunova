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
# The outcome is written to MIGRATION_REPORT_PATH so /api/health can report it.
# On a host with no Shell and no log API, "did the boot migration run, and what
# happened?" is otherwise unanswerable from outside — and the difference between
# "it failed" and "it never ran" is the difference between two very different
# fixes. Exit code and a one-word reason only; never command output, which
# names the database host.
REPORT="${MIGRATION_REPORT_PATH:-/tmp/lunova-migrate.json}"
report() {
  printf '{"ran":%s,"exitCode":%s,"at":"%s","entrypoint":"%s","reason":"%s"}\n' \
    "$1" "$2" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$3" "$4" > "$REPORT" 2>/dev/null || true
}

if [ "$MIGRATE_ON_START" = "0" ]; then
  echo "[entrypoint] MIGRATE_ON_START=0 — skipping migrations"
  report false null skipped ""
else
  echo "[entrypoint] applying database migrations"
  log="$(mktemp 2>/dev/null || echo /tmp/lunova-migrate.log)"
  set +e
  # Redirect rather than pipe to `tee`: POSIX sh has no PIPESTATUS, so `$?`
  # after a pipe is tee's status (always 0) and every failure would look fine.
  node node_modules/prisma/build/index.js migrate deploy > "$log" 2>&1
  code=$?
  set -e
  cat "$log"

  # One scrubbed line of *why*, for /api/health. Any URL is replaced wholesale
  # before it can be recorded — Prisma does not print credentials, but a reason
  # string that reaches an unauthenticated endpoint gets belt and braces.
  reason=""
  if [ "$code" -ne 0 ]; then
    reason="$(grep -iE 'error|cannot find|denied|EACCES|ENOENT|P[0-9]{4}' "$log" \
      | tail -n 1 \
      | sed -E 's#[a-zA-Z+]+://[^[:space:]]*#[url]#g; s#"#'"'"'#g; s#\\#/#g' \
      | cut -c1-160)"
  fi
  rm -f "$log"
  report true "$code" ran "$reason"
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
