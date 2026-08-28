# Experiments

A deterministic, database-free way to try ranking changes and measure them
against the north star. Deliberately small — `Experiment → Variant → Metric →
Result` and nothing more.

## The model

`src/lib/experiments/registry.ts` — an experiment is:

```ts
{
  id: "discovery_music_weight_v1",
  description: "...what and why, and the metric it's judged on",
  unit: "user",
  enabled: false,                 // off ⇒ everyone gets variants[0], no exposure logged
  variants: [
    { id: "control",     weight: 1, config: { weights: {} } },
    { id: "music_heavy", weight: 1, config: { weights: { music: 0.30, ... } } },
  ],
}
```

`config` is a plain object the consumer knows how to apply. For the discovery
experiments it's a partial weight override merged over `WEIGHTS`.

## Assignment

`assignVariant(experimentId, unitId)` — `sha256(`${experimentId}:${unitId}`)` →
`[0,1)` → weighted bucket. Properties:

- **Deterministic.** Same user, same variant, forever. No assignment table.
- **Recomputable.** Given the unit id you can always recover which variant it saw
  — so outcome analysis is a join, not a lookup.
- **Independent.** Salting by experiment id means enrollment in one tells you
  nothing about another.
- **Safe default.** `enabled: false` or an empty unit id ⇒ `variants[0]`.

`exposeVariant(experimentId, unitId)` assigns *and* bumps
`lunova_experiment_exposure_total{experiment,variant}` (a counter — never a
per-user row) and a debug log line. Call it once, where the variant is applied.

## Wired experiments

| id | what it changes | where | metric |
| --- | --- | --- | --- |
| `discovery_music_weight_v1` | music ranking weight 0.22 → 0.30 (`music_heavy`) | `getDiscoveryFeed` → `computeCompatibility(v, c, weights)` | Meaningful Connection Rate, watched against report/block rate |

`computeCompatibility` and `explainCompatibility` take an optional
`weights: WeightOverride` last argument. It is a ranking input only — **no
experiment may ever surface a number to a member.** The score stays server-side;
members still see labels and highlight sentences.

## Reading a result

The experiment is judged on **outcomes together**, never one metric alone
(docs/OBSERVABILITY.md §23): a variant that lifts messages but also lifts
reports/blocks or drops conversation quality has failed.

1. Enrol: set `enabled: true` for the experiment, deploy to staging.
2. Let it run until each variant has enough matches to compare (weeks, not days).
3. For the window, split `getProductSnapshot`-style aggregates by variant using
   the exposure counter + deterministic reassignment offline. (A built-in
   by-variant slice on `/admin/metrics` is a deliberate *later*, not now —
   see docs/PRODUCT-ROADMAP.md.)
4. Ship the winner by making its weights the new `WEIGHTS` default and retiring
   the experiment. Losers are deleted.

## What this is not

- Not a targeting/segmentation engine. One split, whole population.
- Not client-side. Assignment and application are server-only.
- Not permanent. An experiment is a question with an expiry, not a config flag.
