# Security audit — Phase 2

Adversarial pass over authentication, authorization, privacy, admin, and
messaging. Each finding below was reproduced by reading the code path and, where
possible, by an automated attack in
`src/lib/security/adversarial.integration.test.ts`.

Legend: **Fixed** in this pass · **Mitigated** (accepted with a documented
production requirement) · **Deferred** (tracked for the abuse-testing phase).

## Findings

### S1 — `profileVisibility: LIMITED` was not enforced — **Fixed** · High
"Only people I've liked can find me" existed in the schema and the settings UI
but nothing honoured it: a `LIMITED` profile appeared in every discovery feed
and was fully readable at `/u/[id]` by anyone with the URL.
**Fix:** `getDiscoveryFeed` now excludes `LIMITED` candidates unless the
candidate has liked the viewer; `getPublicProfile` returns `null` for a
`LIMITED` target unless connected or the target has liked the viewer.

### S2 — Login / signup timing oracle → account enumeration — **Fixed** · Medium
`verifyPassword` (bcrypt, ~100 ms) ran only when the account existed, so
response time revealed whether an email was registered. Signup returned early
for an existing email before hashing.
**Fix:** `verifyPasswordConstantTime` always spends a bcrypt round (against a
decoy hash when there is no user); signup hashes the password *before* the
existence check and returns the same generic notice either way.

### S3 — Moderator could over-reach on staff / un-ban — **Fixed** · Medium
A `MODERATOR` could `SUSPEND` / `RESTRICT_*` / `WARN` another moderator or an
admin, and could lift a ban via `REINSTATE` / `CLEAR` (only *applying* `BAN`
was admin-gated).
**Fix:** `applyModerationAction` now loads the target; any action against a
non-`USER` role requires `ADMIN`, and `CLEAR` / `REINSTATE` of a `BANNED`
account requires `ADMIN`.

### S4 — `reportAction` conversation IDOR — **Fixed** · Medium
`reportAction` accepted an arbitrary `conversationId` and snapshotted up to ten
messages into `Report.context` — messages from threads the reporter was not in.
**Fix:** the snapshot is taken only when the reporter *and* the reported user
are the two participants of that conversation.

### S5 — OTP had no attempt lockout — **Fixed** · Medium
Email and phone codes counted `attempts` but never acted on the count;
brute-force protection was solely the in-memory rate limiter (per-process,
resets on restart).
**Fix:** after `MAX_OTP_ATTEMPTS` (5) wrong guesses the code is consumed and a
fresh one must be requested. Rate limits remain as a first line.

### S6 — `x-forwarded-for` trusted for rate limiting — **Mitigated** · Low
The leftmost `x-forwarded-for` value is client-controlled; an attacker rotating
it gets a fresh rate-limit bucket. Signup was IP-only.
**Fix / mitigation:** IP extraction now prefers `x-real-ip` (set by a trusted
proxy); signup gained a per-email limit in addition to per-IP. **Production
requirement:** the edge/proxy must overwrite `x-real-ip` / `x-forwarded-for`
with the true client IP.

### S7 — Upload size limit exceeded the action body limit — **Fixed** · Low
`MAX_IMAGE_BYTES` (8 MB) was larger than `serverActions.bodySizeLimit` (4 MB),
so 4–8 MB uploads failed with an opaque framework error.
**Fix:** `bodySizeLimit` raised to `10mb`.

### S8 — Deleted account left sent message bodies behind — **Fixed** · Low
Account deletion closed matches but the words the deleted user had written
stayed in the other person's thread.
**Fix:** deletion now tombstones every message the user sent (`body: ""`,
`deletedAt` set) and also clears their `VerificationToken` rows.

### S9 — `/media/[...key]` has no per-request authorization — **Mitigated** · Low
Photo objects are served to anyone who has the key. Keys are `photos/<a>/<b>/<uuid>.<ext>`
with a v4 UUID, so enumeration is infeasible, and verification selfies are
never served (prefix allow-list). But a key that leaked while two users were
matched stays loadable after a block.
**Production requirement:** the S3 `MediaStorageProvider` must issue
short-TTL signed read URLs; the local route is dev-only.

### S10 — Blocked user could re-open a frozen conversation — **Fixed** · Low
Blocking closes the match, which removes the thread from both connection lists
and disables sending — but the blocked party could still open the thread by URL
and re-read history.
**Fix:** `getConversation` returns `null` to the blocked party when the match
was closed with `closeReason: "BLOCKED"`.

### S11 — No cap on concurrent SSE connections per user — **Deferred**
`/api/realtime` accepts unbounded connections per authenticated user.
Handled in the abuse-testing phase (per-user connection cap + idle timeout).

## What held up

- Session tokens: 32 random bytes, SHA-256 at rest, `httpOnly` + `sameSite=lax`
  + `secure` in production. No fixation (fresh token per login).
- Realtime: the SSE route subscribes strictly to the *session-derived* user id;
  there is no client-supplied channel. `/api/dev/realtime-poke` is 404 outside
  development.
- Every mutating server action goes through `requireUser` /
  `requireOnboardedUser` / `requireRole` and scopes its writes to
  `userId: user.id` or verifies match/conversation participation.
- `sendMessageAction` / `unmatchAction` / `closeMatch` reject actions on a
  match the caller is not part of; a closed match blocks new messages.
- Discovery excludes blocked users (both directions), already-acted profiles,
  paused / incognito / non-onboarded accounts.
- `getPublicProfile` never exposes email, phone, exact location, or
  `CONNECTIONS`-scoped music/activity to a non-connection.
- Storage `safeKey` rejects `..`, absolute paths and backslash-prefixed keys.
- Admin actions write an `AuditLog` row (with IP) for every privileged action.

## Regression coverage

`src/lib/security/adversarial.integration.test.ts` (10 tests) exercises S1, S3,
S4, S5, S10 plus cross-user `getConversation` / `closeMatch`. Run with
`RUN_DB_TESTS=1`.
