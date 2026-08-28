# Product roadmap

Organised by evidence, not ambition. A thing moves up only when user behaviour
(not a single request, not a hunch) says it should. The thesis it must serve:
**how good it feels when two strangers discover each other.**

Last updated: after Phase 3 staging-readiness work, before the first user
sessions. Revise once `docs/USER-RESEARCH-RESULTS.md` is filled in.

---

## Now — launch blockers

Nothing is confirmed as a blocker yet — that's what the user sessions decide.
Provisional list, to be replaced by P0/P1 findings:

- [ ] Run the moderated sessions (`docs/USER-TESTING.md`) on staging.
- [ ] Full screen-reader pass on the live URL (`docs/ACCESSIBILITY.md` gap).
- [ ] Staging security checklist signed off (`docs/STAGING-SECURITY.md` items
      1, 12, 13 need the real host).
- [ ] Lighthouse on staging meets `docs/PERFORMANCE.md` targets.
- [ ] Confirm email + SMS actually deliver from staging providers.

## Next — high-impact, evidence likely

Do after the first round of testing confirms the direction. Ordered by expected
impact on the discovery experience:

1. **Discovery candidate sampler.** Replace `ORDER BY lastActiveAt DESC LIMIT 60`
   with a mix (recent + a random slice) so dormant profiles still surface and
   the feed doesn't collapse to the same faces. (docs/COMPATIBILITY.md known
   limitation.)
2. **"Answer a prompt" flow.** Prompts are display-only from seed today; letting
   members write them is the cheapest way to deepen a thin profile and give the
   opener generator more to work with.
3. **Run `discovery_music_weight_v1`.** Enable the experiment on staging, read
   Meaningful Connection Rate against report/block rate. Ship the winner as the
   default. (docs/EXPERIMENTS.md)
4. **Redis adapter** for rate limiting + realtime, once staging needs >1
   instance. (docs/DEPLOYMENT.md)
5. **Qualitative check on the north star.** Ask a sample of connected pairs
   whether it felt meaningful; validate that "both spoke, ≥6 messages, ≤14 days"
   actually tracks it. Adjust the proxy if not. (docs/OBSERVABILITY.md §22)
6. **Browser error SDK** wired into `error.tsx` / `global-error.tsx`.
7. **By-variant slice on `/admin/metrics`** — only once an experiment is
   actually running and the offline join proves too slow.

## Later — validated opportunities (need evidence first)

- **Spotify OAuth as a music-identity source.** Only the signals Lunova uses
  (top artists, genres, a mood) — never the full listening history, always
  optional, a no-Spotify user must have an equally good experience.
  (Phase 3 items 16–17.)
- **Activity provider mapping** into `ActivityProvider` — a future fitness/
  activity service feeding the *lifestyle* identity, never a fitness score.
  Internal activity identity must remain fully sufficient. (items 18–19.)
- **Identity verification** provider — only if launch scope requires it.
- **Nonce/SRI CSP** to drop `script-src 'unsafe-inline'` — if a compliance need
  appears. (docs/STAGING-SECURITY.md)
- Second locale, once there's a real user base that needs one. The architecture
  is ready (docs/I18N.md).

## Not now — parked until behaviour demands it

Explicitly out of scope for the foreseeable future (Phase 3 item 30). Building
these would dilute the thesis:

- Communities / groups
- Stories / reels / ephemeral media
- Public feeds
- Follower / following systems
- Events
- Elaborate gamification (streaks, points, badges, "most active")
- Any fitness hierarchy — leaderboards, pace/calorie rankings, public activity
  scores. This is a **permanent** no. (item 19)

A feature leaves this list only when repeated, independent user behaviour shows
the core experience is held back without it — not because it's common in other
apps.
