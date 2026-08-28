# External providers

Everything Lunova touches outside its own database is behind an interface in
`src/lib/providers/` (plus `moderation/`, `verification/`, `realtime/`). Each
has a **dev implementation that needs no credentials**, selected by an env var.

| Concern | Env var | Dev default | Real adapters |
|---|---|---|---|
| Email | `EMAIL_PROVIDER` | `console` (prints to stdout) | **`resend`** (implemented) · `ses` (stub) |
| SMS | `SMS_PROVIDER` | `console` | **`twilio`** (implemented) |
| Object storage | `STORAGE_PROVIDER` | `local` (disk, served by `/media`) | `s3` (interface ready — see below) |
| Content moderation | `MODERATION_PROVIDER` | `heuristic` | vendor stub (`hive` / `openai` / `rekognition`) |
| Identity verification | `IDV_PROVIDER` | auto-approve | vendor stub (`persona` / `veriff` / `stripe-identity`) |
| Music | `MUSIC_PROVIDER` | `internal` (typed by hand) | `spotify` OAuth (interface ready) |
| Realtime | `REDIS_URL` unset | in-process fan-out | Redis pub/sub adapter (interface ready) |
| Rate limiting | `REDIS_URL` unset | in-memory window | Redis sorted-set adapter (interface ready) |

## The resilience contract

`src/lib/providers/resilience.ts` — **a temporarily-failing vendor must never
make Lunova unusable.**

- `withRetry(fn, {retries, timeoutMs, retryable})` — per-attempt timeout,
  exponential backoff + jitter. `isRetryableHttp` retries 5xx / 429 / network,
  not other 4xx.
- `bestEffort(label, fn)` — retry, then log and resolve `{ok:false}` instead of
  throwing. Used where a miss is recoverable.

Applied:

| Call site | Behaviour on total failure |
|---|---|
| `issueEmailCode` / phone code send | Best-effort. Signup still completes; the code row exists; "resend" surfaces a hard failure to the user. |
| `moderateText` | **Fail-open** — message is allowed but tagged `deferred` for a later sweep. Messaging never blocks on the vendor. |
| `moderateImage` | **Fail-safe** — photo is held `review`, never auto-approved. |
| `idv.submitPhoto` | Check stays `PENDING` for manual review; the user's submission succeeds. |

## Implemented real adapters

### Email — Resend (`EMAIL_PROVIDER=resend`)
Plain `POST https://api.resend.com/emails` with a bearer token — no SDK. Needs
`RESEND_API_KEY` and `EMAIL_FROM` (a verified sender). Falls back to `console`
with a warning if the key is missing.

### SMS — Twilio (`SMS_PROVIDER=twilio`)
`POST .../Messages.json` with Basic auth — no SDK. Needs `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM`.

## Adding the remaining adapters

Each is a class implementing the existing interface, added to the module's
`build()` switch — no feature code changes.

- **Storage → S3/R2:** implement `StorageProvider` in `src/lib/providers/storage.ts`.
  `put` uploads to the bucket; `publicUrl` returns a **short-TTL signed GET URL**
  (see SECURITY-AUDIT S9 — the media route must not be an unauthenticated
  bearer). Keep `content-type` validation and the 8 MB cap. Use
  `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (works for AWS S3 and,
  with `S3_ENDPOINT`, Cloudflare R2 / MinIO).
- **Music → Spotify:** OAuth (authorization code + refresh). Store only what
  Lunova needs — top artists, a couple of tracks, genres — never a full library
  or a live player. `MUSIC_PROVIDER=spotify` + `SPOTIFY_CLIENT_ID/SECRET`.
- **Moderation vendor:** implement `image()` / `text()` against the vendor's
  classify endpoint; keep the internal `allow/review/reject` mapping. Internal
  scores stay private (never surfaced to users).
- **IDV vendor:** prefer a provider that returns a **result** (a webhook with a
  pass/fail), not one that requires Lunova to hold documents. Wire the webhook
  to `IDV_WEBHOOK_SECRET`; on receipt, flip the `IdentityCheck` and
  `trust.identityVerified`. Deduplicate on the provider reference.
