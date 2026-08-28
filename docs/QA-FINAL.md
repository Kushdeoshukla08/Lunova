# Final QA

Pass over the whole product after the Phase-2 engineering work (visual language,
Discovery rebuild, realtime, security, CI, deployment, providers, i18n,
observability, abuse hardening, compatibility review). Run against the seeded
dev database plus fresh accounts.

## Automated gates (green)

| Check | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `eslint .` | clean |
| Unit + integration (`RUN_DB_TESTS=1`) | 130 passing, 24 files |
| Playwright E2E (golden path + realtime) | 5 passing |
| `next build` | succeeds; marketing pages stay static |
| CI (`.github/workflows/ci.yml`) | static + integration + e2e(main) + audit |

## Core journey — walked end to end

`landing → sign up → verify email → onboarding → discover → like → match →
conversation` and back out through `connections / activity / profile / settings
/ sign out`. No dead ends, no console errors (dev HMR socket warnings in the
in-app browser only — absent in production).

## Discovery — the 5 / 10 / 15-second test

Viewer *Maya* → candidate *Arjun* (real seeded overlap):

- **5s — who is this?** Photo, "Arjun, 31", "Lisbon · 5 km away", "New here",
  and one personality line ("Run club on weeknights, climbing on weekends,
  terrible at rest days."). You know who he is.
- **10s — why would we connect?** "Why you might click" → **Music match** →
  "You both listen to Big Thief · You both cycle · Right nearby". Three concrete
  human reasons. No number, no percentage.
- **15s — what do I say?** "Say something real" → *"I've had Big Thief on repeat
  lately too — what's the one song you always come back to?"* → "Drawn from your
  shared music" → **Send this & like** / **Write your own**.

Depth ("More about Arjun": learning prompt, "In heavy rotation", "Usually
outside", interests) sits *below* the decision content. Passes.

When there is little overlap (e.g. Admin → Arjun) the card degrades well: the
"Why you might click" block is omitted and the opener falls back to a
prompt-based line. Still answerable.

## Guardrail spot-checks

| Guardrail | Observed |
| --- | --- |
| Music ≠ Spotify | "In heavy rotation" + artist names as identity. No player, library, playlists or feed. |
| Activity ≠ Strava | "Movement — a lifestyle signal, not a leaderboard." Tags + "Active roughly 4 days a week" + explicit "We never track pace, routes, or precise locations." No stats, pace, calories, rankings. |
| No "algorithm knows you" | Labels only ("Music match", "Strong connection"). Numeric score never reaches a client component; `/admin/why` is the only place it's shown, staff-only. |
| Safety is quiet but present | Report/block live behind the conversation's safety menu (E2E: "safety controls are present on a conversation"); nothing shouts on the happy path. |
| Explainable internally | `/admin/why?viewer=&candidate=` — per-signal raw × weight = contribution, gates, distance. |
| No popularity bias | `CompatInput` has no likes/engagement/attractiveness/verification/spend field. Asserted in `engine.test.ts`. |

## Responsive & theme

| Surface | Result |
| --- | --- |
| Mobile 375 | No horizontal overflow. Bottom tab nav (grid). Sticky Pass / Like bar with aria labels. Desktop rail hidden. |
| Desktop | Left rail nav; content max-width capped; comfortable line length. |
| Dark (`prefers-color-scheme`) | body `#151119`, ink `#f4ecf2`; toggle also honoured via `data-theme`. Tokens defined on bare `:root`, no unthemed colours. |
| Distance units | Metric by default; imperial only for known US/GB/LR/MM `profile.country`. |

## Empty vs populated

- **Empty** (`/connections` with no matches): "No connections yet — when you and
  someone both like each other, they'll show up here with a reason to talk."
  `/discover` with no candidates: "No one new right now" + "Adjust preferences".
  `/activity` with nothing added: "Add your movement identity".
- **Populated**: seeded feed ranks and renders with highlights; profile strength
  meter shows an actionable nudge.

## Would someone screenshot it / tell a friend / feel it's different?

- **Screenshot:** the match moment (breathing halo, "You found something in
  common", the shared-thing headline) and a Discovery card's "Say something
  real" opener are the shareable beats. Yes.
- **Tell a friend:** "it tells you *why* you match and writes you a real opener"
  is a one-sentence pitch that isn't Tinder/Hinge/Bumble.
- **Different from Tinder/Hinge/Bumble:** no swipe-for-dopamine loop (the card is
  a page you read, not a stack you flick), no compatibility percentage, music
  and movement as identity rather than bolt-on badges, and the product's success
  metric is *meaningful connections*, not matches or time in app.

## Known limitations (tracked, not blockers)

1. Discovery candidate **pool** is `ORDER BY lastActiveAt DESC LIMIT 60` before
   ranking — needs a fairer sampler (random slice) once the user base is large
   so dormant profiles still surface. (docs/COMPATIBILITY.md)
2. Rate limits use the in-memory adapter — a multi-instance deploy needs the
   Redis adapter for them to be global. (docs/DEPLOYMENT.md)
3. Prompt answers are seed-only; there is no "answer a prompt" flow yet. Product
   gap, not a regression.
4. Profile nudge copy ("profiles with more photos get seen more") is true
   (completeness aids discovery filtering) but should be watched so it doesn't
   drift into engagement-baiting.
5. Client-side error boundaries log to console only — a browser error SDK would
   need wiring separately. (docs/OBSERVABILITY.md)
