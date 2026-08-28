# Observability

Enough signal to run Lunova reliably and know whether it's working as a
*product* — and deliberately not one inch more.

## The line we don't cross

> Do not build a surveillance system.

- **No behavioural event stream.** We do not log "user X viewed profile Y",
  "user X opened the app at 21:04", "user X hovered the like button". The
  structured logger (`src/lib/observability/logger.ts`) records what the
  *system* did, and its redaction pass drops `email`, `phone`, `ip`,
  `useragent`, `token`, `code`, `body`, `lat`/`lng` and similar keys before a
  line is ever written.
- **Product metrics are aggregate-only** (`src/lib/observability/product.ts`).
  Every figure is a COUNT or RATIO over the whole population in a time window.
  There is no per-person funnel, no cohort-by-identity, no drill-down to a name.
- **System metrics carry no user identity** (`src/lib/observability/metrics.ts`).
  Labels are things like `label="sms.send"`, `outcome="failed"`,
  `action="login"` — never a user id.
- Raw tables we already keep for legitimate reasons (`LoginAttempt`,
  `SafetyEvent`, `AuditLog`) are the source for security/safety analysis. The
  observability layer reads them in aggregate; it does not add a parallel trail.

## The three surfaces

### 1. Structured logs — `log`

```ts
import { log } from "@/lib/observability/logger";
log.info("match created", { kind: "music" });
log.warn("sse connection cap hit", { active });
const done = log.timer("discovery feed");  // …work…  done();
```

One JSON object per line in production (`{ts,level,msg,env,…}`), a compact
human line in dev. Level via `LOG_LEVEL` (`debug|info|warn|error`; default
`info` in prod, `debug` in dev). `log.child({…})` binds fields.

### 2. Error tracking — `captureError`

```ts
import { captureError } from "@/lib/observability/errors";
captureError(err, { scope: "provider.email.send", fields: { bestEffort: true } });
```

Produces an error-level log with a stable `fingerprint` and bumps
`lunova_errors_total{scope}`. Wired into `providers/resilience.ts`
(`bestEffort`), `notifications`, and `safety/events`. When `SENTRY_DSN` is set,
`forward()` in `errors.ts` is the single drop-in point for a real tracker —
add the SDK there; the base image ships without a vendor SDK.

Client-side (`app/**/error.tsx`) still uses `console.error`; a browser error
SDK would go there separately.

### 3. Metrics — `metrics` + `GET /api/metrics`

In-process registry, Prometheus text format. **Disabled unless `METRICS_TOKEN`
is set**; requires `Authorization: Bearer $METRICS_TOKEN`. Process-local
(resets on deploy) — fine for one always-on container; a multi-replica future
aggregates at the scraper.

| Metric | Type | Meaning |
| --- | --- | --- |
| `lunova_auth_attempts_total{action,outcome}` | counter | login attempts by outcome (`success`, `bad_password`, `no_user`, `banned`, `rate_limited`) |
| `lunova_provider_calls_total{label,outcome}` | counter | email/SMS/moderation/IDV calls (`ok`, `ok_after_retry`, `retry`, `failed`) |
| `lunova_moderation_calls_total{kind,action}` | counter | moderation verdicts (`allow`/`review`/`reject`/`provider_unavailable`) |
| `lunova_errors_total{scope}` | counter | errors through `captureError` |
| `lunova_sse_connections` | gauge | open realtime streams |
| `lunova_sse_rejected_total` | counter | streams refused by the per-user cap |
| `lunova_db_ping_ms` | histogram | Postgres round-trip on `/api/metrics` scrape |
| `lunova_db_up` | gauge | 1/0 from the last scrape ping |

`metrics.time(name, labels, fn)` wraps an async call into a latency histogram
with an `outcome` label.

### Health — `GET /api/health`

Unauthenticated liveness/readiness for the load balancer: 200 only when a
Postgres `SELECT 1` succeeds, 503 otherwise. No metrics, no secrets.

## Product health — `GET /admin/metrics`

ADMIN/MODERATOR only. Windows: 7 / 30 / 90 days.

**North star — Meaningful Connection Rate.** Of matches created in the window,
the fraction whose conversation, within 14 days, had **≥1 human message from
both people** and **≥6 human messages total**. Two people actually talked —
not one-sided, not "hey". This is the only number we optimise for.

Supporting aggregates: signups, onboarding completion rate, likes sent,
matches, like→match rate, conversations started, match→conversation rate,
reports, blocks, reports per 1k matches. All population-level.

Metrics we intentionally **do not** compute: swipes, session length,
time-in-app, notification opens, DAU/MAU, raw match count as a goal. A member
who finds someone and leaves is a success.

## Plugging in real infrastructure

- **Metrics:** point Prometheus / Grafana Agent / Grafana Cloud at
  `/api/metrics` with the bearer token. Dashboards + alerts live there.
- **Errors:** set `SENTRY_DSN`, add `@sentry/node` in `errors.ts` `forward()`.
- **Logs:** stdout is already JSON — ship with whatever the platform provides
  (Loki, CloudWatch, Datadog agent). No app change needed.

## Env

| Var | Default | Effect |
| --- | --- | --- |
| `LOG_LEVEL` | `info` (prod) | minimum level emitted |
| `METRICS_TOKEN` | — | unset ⇒ `/api/metrics` returns 404 |
| `SENTRY_DSN` | — | unset ⇒ errors logged only |
