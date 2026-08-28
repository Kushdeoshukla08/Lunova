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

### S6 — `x-forwarded-for` trusted for rate limiting — **Fixed** · Medium
The leftmost `x-forwarded-for` value is client-controlled; an attacker rotating
it gets a fresh rate-limit bucket. Signup was IP-only. The earlier mitigation
preferred `x-real-ip`, which is *also* just a request header — it is only
trustworthy if the edge overwrites it, and nothing verified that it did.
**Fix:** `lib/security/client-ip.ts` counts in from the **right** of
`x-forwarded-for` by `TRUSTED_PROXY_HOPS` (default 1). A proxy appends the peer
it saw, so the Nth-from-the-right entry is the first value the client could not
forge; everything to its left is ignored, as is `x-real-ip`. Unresolvable
requests share one `unknown` bucket rather than each getting a fresh allowance.
**Deployment requirement:** `TRUSTED_PROXY_HOPS` must equal the number of
proxies actually in front of the app — 1 on Render, 2 behind a CDN, 0 if
exposed directly.

### S7 — Upload size limit exceeded the action body limit — **Fixed** · Low
`MAX_IMAGE_BYTES` (8 MB) was larger than `serverActions.bodySizeLimit` (4 MB),
so 4–8 MB uploads failed with an opaque framework error.
**Fix:** `bodySizeLimit` raised to `10mb`.

### S8 — Deleted account left sent message bodies behind — **Fixed** · Low
Account deletion closed matches but the words the deleted user had written
stayed in the other person's thread.
**Fix:** deletion now tombstones every message the user sent (`body: ""`,
`deletedAt` set) and also clears their `VerificationToken` rows.

### S9 — `/media/[...key]` has no per-request authorization — **Fixed** · Medium
Photo objects were served to anyone holding the key, in any moderation state,
without a session. Random UUIDs made enumeration infeasible, but a key that
leaked while two people were matched stayed loadable forever — including after
a block, and including photos still in the moderation queue.
**Fix:** the route now authorizes every request against the `Photo` row
(`storageKey` is unique, so it is a point read): signed-in members only, a
photo in moderation is visible only to its owner, blocks apply in both
directions, and photos of banned/deleted accounts are hidden. Denials are 404
so the route is not an existence oracle. With `STORAGE_PROVIDER=s3` the bucket
stays private and the route redirects to a short-TTL presigned URL after the
check, rather than the bucket being publicly readable.

### S10 — Blocked user could re-open a frozen conversation — **Fixed** · Low
Blocking closes the match, which removes the thread from both connection lists
and disables sending — but the blocked party could still open the thread by URL
and re-read history.
**Fix:** `getConversation` returns `null` to the blocked party when the match
was closed with `closeReason: "BLOCKED"`.

### S11 — No cap on concurrent SSE connections per user — **Fixed** · Low
`/api/realtime` accepted unbounded connections per authenticated user.
**Fix:** `MAX_STREAMS_PER_USER` (8); an extra stream gets 429 + `Retry-After`
and the client reconnects, so the cap degrades gracefully.

## Second pass — production hardening

### S12 — Upload MIME type was taken from the client — **Fixed** · High
`file.type` is the multipart header: a browser sets it honestly, `curl` sets it
to anything. Uploads were accepted, stored under an extension derived from that
claim, and later served with a `Content-Type` derived from the same claim. HTML,
SVG, a shell script or a GIF/PNG polyglot could all be stored as `.png`.
**Fix:** `lib/media/image.ts` identifies the container from its own bytes
(JPEG/PNG/WebP/AVIF) and requires the declaration to match; everything else is
rejected. The media route adds `nosniff`, `Content-Disposition: inline` and a
`default-src 'none'; sandbox` CSP so a stored object can never be interpreted as
an active document.

### S13 — No image dimension limits — **Fixed** · Medium
Only a byte cap existed, so a ~60-byte PNG header declaring 30000×30000 passed
validation and would be expanded by any downstream decode.
**Fix:** min/max per-axis and a total pixel budget, all read from the container
header — the bomb is rejected on its declared geometry and never decoded. Real
`width`/`height` are now persisted (the columns existed but were never written).

### S14 — Privacy controls collected but never enforced — **Fixed** · Medium
`showAgeExact` and `distanceVisibility` were shown in Settings, validated, and
written to the database — then ignored on every read path. Discovery, the public
profile and the conversation header all rendered the exact age, and Discovery
always rendered a distance.
**Fix:** both are applied where the payload is shaped. Withheld ages fall back
to a coarse band (`describeAgeBand`, roughly a third of a decade); matching and
ranking still use the true birthdate, so only the *display* changes.
See `src/lib/discovery/privacy-projection.integration.test.ts`.

### S15 — `/api/metrics` compared its bearer token with `!==` — **Fixed** · Low
A byte-by-byte comparison returns as soon as it differs, leaking the token
prefix through response timing.
**Fix:** both sides are SHA-256'd and compared with `timingSafeEqual`.

### S16b — A one-sided like named the person who sent it — **Fixed** · High
`NEW_LIKE` notifications carried `fromUserId`, so the list rendered
"*Name* liked you" before the like was mutual. Identity in this product is
supposed to be revealed when **both** sides opt in; naming the liker also routed
straight around `incognito` ("only people I've liked can see me") and
`profileVisibility: LIMITED` — you could be hidden from someone's Discover and
still have your name pushed to their notifications.
**Fix:** the liker's id is no longer written into the payload at all (so nothing
downstream can resolve it either) and the renderer says "Someone liked you"
regardless. The comment they chose to send is kept — those are their own words.
Names appear on `NEW_MATCH`, where both people have consented.
See `src/lib/notifications/like-anonymity.integration.test.ts`.

### S16 — Conversation header computed age by year subtraction — **Fixed** · Low
`getFullYear() - birthYear` is one too high until the birthday passes, so the
thread header could disagree with the profile.
**Fix:** uses the shared `ageFromBirthdate`.

## Open — needs a product decision, not a patch

### S17 — `showActiveStatus` has no member-facing surface
The control is offered in onboarding and Settings and is written to the
database, but last-active time is shown only in the admin panel, so the switch
changes nothing a member can see. It is not a leak — it is a promise the
product does not currently make. Either surface active status (and honour the
flag) or remove the control; leaving it is mildly misleading.

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
- Storage `isSafeKey` validates segment by segment: no `.`/`..`, no absolute,
  UNC or drive-letter paths, no control bytes, no URL-significant characters.
- Admin actions write an `AuditLog` row (with IP) for every privileged action.
- Login and signup are enumeration-safe: one message for both failure modes, and
  the bcrypt cost is always spent so the response time does not branch on
  whether the address exists.
- Account deletion revokes sessions, tombstones sent message bodies, deletes
  photos from the object store, and anonymises the account shell.

## Regression coverage

Run everything below with `RUN_DB_TESTS=1`.

| Suite | Covers |
|---|---|
| `lib/security/adversarial.integration.test.ts` | S1, S3, S4, S5, S10, cross-user `getConversation` / `closeMatch`, moderator privilege limits |
| `lib/security/abuse.integration.test.ts` | block bypass, unmatch-then-block, one-sided flood, profile text screening |
| `lib/security/client-ip.test.ts` | S6 — forged `X-Forwarded-For` prefixes land in one bucket |
| `lib/media/image.test.ts` | S12, S13 — polyglot, SVG, HTML, decompression bomb, marker soup |
| `lib/providers/storage.test.ts` | key traversal, absolute/UNC paths, control bytes |
| `app/media/route.integration.test.ts` | S9 — anonymous, blocked, banned, in-moderation, traversal |
| `lib/discovery/privacy-projection.integration.test.ts` | S14 — age/distance actually withheld |
| `app/api/metrics/route.test.ts` | S15 — token guard |
| `app/api/health/route.test.ts` | no secret can appear in the public probe |
| `lib/notifications/like-anonymity.integration.test.ts` | S16b — a like never names its sender |
| `lib/security/account-lifecycle.integration.test.ts` | suspended / banned / deleted accounts: feed, profile, photos, messaging, password |
| `lib/discovery/query-budget.integration.test.ts` | read paths stay constant-cost as the feed grows |

## Probed and clean

Checked live against a running server, not only by reading the code:

| Attack | Result |
|---|---|
| Cross-origin Server Action POST | rejected — "Invalid Server Actions request" |
| Server Action POST with no `Origin` | 404 |
| `/api/realtime` with no session | 401 |
| `/api/metrics` with no token | 404 (disabled), 401 (wrong token) |
| `/discover`, `/connections`, `/settings`, `/profile`, `/admin`, `/u/:id` unauthenticated | 307 → `/login` |
| `/admin` as a non-staff member | redirected to `/discover` |
| Malformed JSON to a route handler | 400, no stack trace in the body |
| Error responses | carry a digest, never a stack |
