# The compatibility engine

`src/lib/compatibility/engine.ts`. Pure functions, no DB, no framework. It
produces a **ranking signal**, not a prediction that two people will have a
good relationship — and the UI never presents it as one.

## What it is allowed to know

The engine only ever sees a `CompatInput` (`types.ts`):

- age (from birthdate), gender, relationship intent
- approximate location (lat/long) + the two people's distance preferences
- interest slugs
- music: shared artists + genres (lower-cased)
- movement: shared activity types
- which self-reflection prompts each person has answered

That's the whole input. It is built by `load.ts` / the discovery batch loader
from profile data the member entered themselves.

## Signals and weights

Six signals, each a pure function returning a 0–1 score plus optional
human-language highlights. Fixed weights, summing to 1:

| Signal | Weight | 1.0 means |
| --- | --- | --- |
| music | 0.22 | multiple shared artists |
| interests | 0.20 | strong overlap of stated interests |
| activity | 0.20 | several shared movement types |
| intent | 0.16 | same relationship intent |
| distance | 0.14 | well inside both people's reach (0.5 flat in global mode) |
| personality | 0.08 | answered several of the same prompts |

`score = Σ (signal.score × weight)`, clamped to [0, 1]. The weights live in one
exported `WEIGHTS` constant — changing the model is a one-line diff, reviewable.

Music is weighted highest because it is Lunova's sharpest taste signal; it is
still only ~a fifth of the score, so someone with no music profile is not
excluded — they just lean on the other five signals.

## What is deliberately NOT a signal

The engine has **no term** for any of:

- likes received, matches count, how many people messaged them
- reply rate, session frequency, time in app, "engagement"
- any attractiveness / photo-quality proxy
- verification status, profile completeness, account age
- spend, subscription tier, job title, income

None of these are in `CompatInput`, so they cannot leak into ranking even by
accident. `explainCompatibility` (below) asserts the signal set in tests.

### Known secondary effects

- The discovery **candidate pool** is pulled `ORDER BY lastActiveAt DESC LIMIT 60`
  before ranking. That favours recently-active people getting *considered*, not
  ranked higher. At larger scale this needs a fairer sampler (e.g. mix in a
  random slice) so dormant profiles still surface. Tracked, not yet needed.
- New accounts get a small tie-break nudge **up** in `discovery/service.ts` — an
  intentional counter to incumbency, not a popularity effect.

## No "algorithm knows you" language

The numeric `score` is internal. It never reaches a client component
(`DiscoveryProfile.compatibility` is `{ label, highlights }` only) and is never
rendered as a percentage. Members see:

- a **label** from a fixed set — "Strong connection", "Music match",
  "Activity match", "A lot in common", "Different worlds, similar energy",
  "Worth a look" — chosen by `pickLabel`.
- **highlight sentences** in the second person — "You both listen to Big Thief",
  "3 activities in common", "You're looking for the same thing".

No certainty claims, no "94% compatible", no science voice.

## "Why did this person appear?" — the internal explanation

`explainCompatibility(viewer, candidate)` returns a `CompatibilityExplanation`:
every signal's raw score, its weight, its `contribution` (raw × weight), the
highlight text it produced, the preference gates, and the distance. Rows are
sorted by contribution — the honest "why", strongest first.

It is computed from the **same** `runSignals()` call as the score, so the
explanation can never disagree with the ranking.

Operators reach it at **`/admin/why?viewer=<id>&candidate=<id>`** (ADMIN /
MODERATOR). It is never exposed to members.

## Preference gates

Ranking is separate from eligibility. `mutuallyEligible` is true only when
**both** people's age and gender filters accept the other. The discovery feed
also applies distance (unless either side is in global mode), blocks,
already-acted, paused/incognito, and photo-present filters in SQL before the
engine runs. A high score never overrides a stated preference.
