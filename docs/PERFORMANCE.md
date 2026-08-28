# Performance

The bar: the moment two strangers discover each other has to feel instant and
smooth. Everything else is secondary.

## Targets (measure on staging, mid-tier phone, throttled 4G)

| Metric | Target |
| --- | --- |
| Landing LCP | < 2.0 s |
| Discovery — first card interactive | < 2.5 s |
| Like / Pass → next card | < 150 ms perceived (animation is 160–200 ms) |
| Cumulative Layout Shift (any core page) | < 0.05 |
| Message send → appears in thread | < 100 ms optimistic, server confirm async |
| Route transition (client nav) | < 300 ms |
| JS on the landing page | keep lean; no third-party scripts at all |

## What already supports this

- **Static marketing pages.** `/`, `/terms`, `/privacy`, `/safety`,
  `/styleguide` are prerendered (`○` in the build) and CDN-cacheable. The CSP is
  header-based (no per-request nonce) *specifically* to keep them static.
- **Fonts self-hosted.** `next/font/google` downloads Fraunces + Inter at build
  time and serves them same-origin with `display: swap` — no render-blocking
  font request, no FOIT.
- **Images.** `next/image` everywhere, `qualities: [50, 75, 90]`. Discovery and
  profile photos store `width`/`height` and render a blurhash placeholder, so
  photo loads cause **zero layout shift**.
- **Bounded DOM in Discovery.** The deck renders one card at a time, not a stack
  — the queue is in memory, not in the tree.
- **No fetch waterfalls.** Server Components + server actions; the client does
  optimistic message rendering and otherwise re-reads server truth.
- **Compositor-friendly motion.** All animation is `transform`/`opacity`,
  `motion-safe:` gated, and near-zeroed under `prefers-reduced-motion`.
- **One realtime connection.** SSE, 25 s heartbeat, capped at 8 per user; events
  are invalidation nudges, never payloads the UI depends on.
- **`output: "standalone"`.** Minimal server bundle in the container.

## Measure on staging

1. Lighthouse (mobile preset) on `/`, `/discover` (logged in), a conversation.
   Record LCP, TBT, CLS, and total transferred JS.
2. WebPageTest from one far region (staging is single-region) to see real RTT
   cost — informs whether a CDN in front of the app is worth it.
3. `performance.getEntriesByType('navigation')` and a `PerformanceObserver` for
   `layout-shift` while walking the journey.
4. Watch `lunova_db_ping_ms` and add a histogram around `getDiscoveryFeed` if the
   feed feels slow with the full persona set.

## Rules

- No animation that drops frames on a mid-tier phone. If a flourish costs
  smoothness, the flourish loses.
- No new third-party script on any page without a hard justification.
- Any new image path goes through `next/image` with explicit dimensions.
- Don't ship a bigger client bundle to make a Server Component into a Client
  Component for a small interaction — reach for a tiny island instead.
