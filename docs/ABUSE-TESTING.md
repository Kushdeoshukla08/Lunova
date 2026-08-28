# Abuse & safety testing

Adversarial pass over the safety-critical paths — not a checklist, an actual
attempt to behave like each bad actor and see what the system let through.
Fixes landed in the same change; `src/lib/security/abuse.integration.test.ts`
locks them in (RUN_DB_TESTS=1).

## Method

For each persona: enumerate the moves, run them against real Postgres via the
service/action layer (not the UI — the UI is not the boundary), note what held
and what didn't, fix the gaps, add a regression test.

---

## Persona: the harasser

*Goal: keep reaching someone who doesn't want contact.*

| Move | Before | After |
| --- | --- | --- |
| Message after being blocked | Blocked — `blockUser` closes the match, `sendMessageAction` stops on `closedAt`. | Held, **plus** an explicit `isBlockedEitherWay` check in `sendMessageAction` so a lagging/again-open match row can't be a bypass. |
| Re-open and re-read the thread after blocking | The blocked party could still GET the thread unless `closeReason === "BLOCKED"` **and** they weren't `closedById`. An **unmatch-then-block** left `closeReason = UNMATCHED`, so the blocked party kept read access. | `getConversation` now checks the **Block row's direction**: whoever is `blockedId` loses read access however the match closed; the blocker keeps it (to file a report). |
| Re-discover the victim on a new account | Inherent to any platform. Mitigations: per-IP + per-email signup rate limits, `LIMITED` profile visibility ("only people I've liked"), block + report → moderation queue, `DUPLICATE_ACCOUNT_SUSPECTED` safety signal. Not "fixed" — managed. |
| Like-bomb the victim's profile to spam notifications | 200/day cap only. | Added a **burst cap** (`likesBurst`, 40/hour) on top of the daily limit. |

## Persona: the spammer

*Goal: blast the same opener at as many people as possible.*

| Move | Before | After |
| --- | --- | --- |
| Mass-like to farm matches | 200 likes/day. | 200/day **and** 40/hour burst. |
| Fire 100 messages/hour across many matches | 120/hour global cap. | Unchanged — 120/hour is a reasonable human ceiling. |
| Hammer one unresponsive person | Only the global cap; could send dozens to one silent thread. | **One-sided flood guard**: after 12 messages since the other person's last reply (or thread start), sends are refused with "Give them a chance to reply" and a `MESSAGE_SPAM_SUSPECTED` safety event is recorded. A reply resets the count. |

## Persona: the scammer

*Goal: pull people off-platform ("invest with me", "text me on Telegram").*

| Move | Before | After |
| --- | --- | --- |
| Contact info / off-platform push in a **message** | `moderateText` returns `review` → still delivered, flagged for later. (Deliberate — first contact isn't blocked, it's logged.) | Unchanged. |
| Contact info / scam copy in the **profile** (bio, display name, listening mood, movement blurb) — seen by *everyone* in discovery | **Not screened at all.** Onboarding only moderated photos. | `screenProfileText` runs `moderateText` on every free-text profile field at save time. `reject` blocks the save with a field error; `review` saves but records `CONTENT_FLAGGED` for the moderation queue. |

## Persona: the stalker

*Goal: figure out where the target physically is.*

| Probe | Result |
| --- | --- |
| Precise coordinates in an API response | None. `latitude`/`longitude` are used only server-side in the compatibility engine; `DiscoveryProfile` and `PublicProfile` expose only `city` and a **coarse** `distanceText`. |
| Precise distance | `describeDistance` rounds to 5 km (city) / 25 km (region) / 1 km (neighbourhood) and collapses anything under 2 km to "Nearby". Now also unit-aware, same rounding. |
| Activity data — routes, timestamps, pace, start/end points | The activity model stores none of it: free-text lifestyle line, `activeDaysPerWeek` (0–7), activity tags. Nothing to leak by design. |
| Active-status / "last seen" | No presence feature exists (deliberate omission). |

No changes needed — the location model was already minimal.

## Persona: rogue staff

*Covered in docs/SECURITY-AUDIT.md (S6–S8).* Recap: a MODERATOR cannot action
another staff account or reverse a ban; `CLEAR`/`REINSTATE` of a BANNED account
requires ADMIN; every moderation action writes an `AuditLog` row in the same
transaction as the effect, so there is no un-audited path.

## Persona: account takeover

*Covered in docs/SECURITY-AUDIT.md (S1–S3).* Recap: opaque session tokens
(SHA-256 at rest), constant-time password check, login attempts recorded with a
`SUSPICIOUS_LOGIN` safety event after repeated failures, "sign out everywhere"
revokes all sessions.

---

## What is intentionally *not* blocked

- A single message containing contact info (logged, not rejected — avoids
  punishing "my number is…" between two people who want to talk).
- Re-registration after a ban beyond the duplicate-account signal — hard bans
  are an ops/enforcement decision, not something to fake in code.
- Rate limits are process-local (memory adapter); a multi-instance deploy needs
  the Redis adapter (`REDIS_URL`) for them to be global. Documented in
  `src/lib/rate-limit.ts`.
