# ─── deps ────────────────────────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── build ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate \
 && DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="build-only-build-only-build-only-build-only" \
    npm run build
# Gather the modules the Prisma CLI loads for `migrate deploy`. The standalone
# trace covers only what the app imports, and the CLI is a devDependency, so
# none of it is traced. The list lives in the script (with the test that keeps
# it honest) rather than being spelled out here twice.
RUN node scripts/migrator-deps.mjs /migrator-node-modules

# ─── runtime ─────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
# HOSTNAME=0.0.0.0 is required: the Next standalone server binds to
# `process.env.HOSTNAME || '0.0.0.0'`, and container platforms (Render, k8s) set
# HOSTNAME to the pod name — Next would then listen on an address the router
# can't reach, and every request 502s. PORT is overridden by the platform.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r lunova && useradd -r -g lunova lunova

# standalone server bundle + static assets + Prisma client + CLI (for migrate deploy)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
# Prisma CLI for `migrate deploy` on boot. Copy the packages whole and invoke
# node_modules/prisma/build/index.js directly (the .bin/prisma shim is a symlink
# Docker flattens into a broken copy). `dotenv` is imported by prisma.config.ts
# and is NOT traced into the standalone bundle, so bring it along.
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/dotenv ./node_modules/dotenv
# …and the rest of what the CLI loads: @prisma/config's loader stack (effect,
# c12 and friends). Without these the boot migration dies on
# `Cannot find module 'effect'` and the database silently drifts behind the code.
COPY --from=build /migrator-node-modules ./node_modules
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Writable upload dir for STORAGE_PROVIDER=local (staging free tier). Ephemeral —
# wiped on redeploy; that's expected. Production uses S3/R2 and never touches this.
RUN mkdir -p /app/.uploads && chown -R lunova:lunova /app/.uploads

USER lunova
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+ (process.env.PORT||3000) +'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# The entrypoint applies pending migrations, then execs CMD. See the script for
# why that happens here rather than in a release hook.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
