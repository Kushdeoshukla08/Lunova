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

# ─── runtime ─────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
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
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Writable upload dir for STORAGE_PROVIDER=local (staging free tier). Ephemeral —
# wiped on redeploy; that's expected. Production uses S3/R2 and never touches this.
RUN mkdir -p /app/.uploads && chown -R lunova:lunova /app/.uploads

USER lunova
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+ (process.env.PORT||3000) +'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# The entrypoint optionally runs `prisma migrate deploy` first (set
# RUN_MIGRATIONS_ON_START=1 on hosts without a release hook), then execs CMD.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
