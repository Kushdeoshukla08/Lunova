# Product audit — MVP → world-class

First-run walkthrough of every major flow. Findings are ordered by impact.
`P0` = blocks the "this feels like a better way to meet people" goal ·
`P1` = meaningful friction or missed emotion · `P2` = polish.

## Cross-cutting

| | Finding | Level |
|---|---|---|
| Visual identity | The system is clean but *reads as tasteful minimal SaaS*, not a recognisable consumer brand. Fraunces is used only for headings; motion is nearly absent; the celestial motif (`.aurora`) appears on 2 screens and never as identity. Nothing about a screenshot says "Lunova". | **P0** |
| Motion | Card swaps, route changes and match reveal are instant. Nothing has weight. A product about *people* should not feel like paging through records. | **P0** |
| Depth / hierarchy | Every surface is one flat card with the same 20px radius and a barely-there shadow. Profiles don't feel layered or physical. | P1 |
| Density | Discovery card and `/u/[id]` are long single scrolls of labelled chip rows. Correct information, no rhythm. | P1 |
| Empty/loading | `(app)/loading.tsx` is a single generic skeleton; per-surface skeletons would feel intentional. | P2 |

## 1. Landing — **good**
Copy is on-message, structure is right (hero → 3 pillars → the loop → safety). The static preview card is doing real work. P2: hero CTA and header CTA share a style; the hero one should feel more like *the* action. No motion on scroll-in.

## 2–3. Signup / Verification — **solid**
Short, honest, age gate server-side, "dev: code in console" note is a nice touch. P1: after verify you land on a placeholder `/onboarding` splash ("You're in, testflow") before the real flow — one dead screen. P2: no password-strength affordance while typing.

## 4. Onboarding — **functional, not delightful**
9 steps, resumable, honest sub-copy. P1: it's a stack of standard forms with a thin progress bar — no sense of *building an identity*, no preview of the card taking shape. P1: photo step can't reorder or crop. P2: "Continue" is full-width lg on every step; feels heavy by step 6.

## 5. Profile — **utilitarian**
`/profile` is a strength meter + a list of "Edit →" rows + toggles. Reads like an account page, not "this is me". P1: no way to *see your own discovery card* (preview how others see you). `/profile/edit` stacks all 9 sections — long.

## 6. Discovery — **the hero, and it's underbuilt** — **P0**
- Photo area shows **only the primary photo** — the carousel dots/swipe never appear even when the person has multiple photos (they're buried under "See full profile"). Browsing photos is table stakes.
- **No short personality line at the top.** Arjun's bio ("Run club on weeknights… learning to make proper dal") is hidden behind "See full profile". The spec's structure puts a personality statement right after the name.
- "Why you might connect" is present and good (label + 3 highlight chips) but it's a single block near the top; there's no *payoff* restatement after you've read the profile.
- Identity rows (`On repeat` / `How they move` / `Into`) are unlabelled `<section>`s of chips — readable but they don't *feel* like music or movement, just tags.
- **Nothing answers "what could I say?"** except a "React to something" button. The opener idea is one click away, not surfaced.
- No transition between cards; the deck just re-renders.
- `region` landmarks after the first are unlabelled (a11y).

## 7. Profile detail (`/u/[id]`) — **flat**
Bio + prompts + chip rows, no "shared with you" layer, photos not obviously browsable. It's a data dump of a good profile.

## 8. Compatibility — **engine good, presentation thin**
The engine produces genuinely nice human strings ("You both listen to Big Thief", "Music match"). But they only appear as small chips in one spot. The *why* deserves more room and more warmth.

## 9–10. Like / Reaction — **works, not felt**
Like/Pass are a plain × circle and a filled button. The react sheet is genuinely good (pick an element → write a line → "Send & like"). P1: the sheet is hidden behind a secondary button; a first-time user won't discover it. P2: no haptic-feeling feedback on like/pass.

## 11. Match — **too plain** — **P1**
`MatchMoment` shows "You found something in common" + one highlight chip + "Send a message". Right instinct (elegant, one connection) but it's a small centred modal with a `✦` — no moment, no delight, no motion.

## 12. Messaging — **clean, missing context** — **P1**
Thread has day grouping, optimistic send, safety menu — all good. But **the conversation carries no memory of why you matched.** Spec explicitly wants a "You matched through 🎵 Music · 🏃 Movement" strip so the first messages aren't "hey"/"hey". The empty state is just the system line.

## 13. Music — **not native** — **P1**
Rendered as `ON REPEAT` + three plain grey-ish chips + a quote. Reads as a tag list. Spec wants "Currently in my rotation" / "Our music overlap → you both listen to ___" as a first-class identity block with its own visual treatment (moonlight accent exists but is unused here).

## 14. Activity — **not native** — **P1**
Same shape as music: `HOW THEY MOVE` + chips + quote. The `/activity` tab is now real (own movement identity) but the discovery presentation is still just tags. Needs "Usually outside · Running · Hiking" phrasing and a distinct treatment.

## 15. Privacy — **thorough, buried**
Per-field visibility is all there and enforced server-side (verified). P2: it's three `<Select>`s deep in settings; the *concept* ("you control what's shared") never shows up where people make sharing decisions (onboarding, profile edit).

## 16. Safety — **strong**
Block/report/unmatch on every conversation and profile, 11 categories, evidence snapshot, private trust signals, real moderation queue. This is genuinely good and matches the spec. P2: the safety menu is a `⋯` — a first-timer may not find "report".

## 17. Notifications — **fine**
Feed + bell + unread. P2: icons are raw glyphs (`✦ ✉ ♥ shield`), one is literally the word "shield". Types could be warmer.

## 18. Settings — **complete, generic**
Everything is here (sessions, blocked list, deletion with typed confirm, notification prefs). Reads exactly like every SaaS settings page. Acceptable — but the account/verification card could carry more trust signal.

## 19. Account deletion — **correct**
Typed `DELETE`, anonymises, closes matches, purges photos. Verified by integration test. Good.

## 20. Admin — **good for an internal tool**
Own chrome, `requireRole`, queue + detail + member view + action panel, every action audited with IP. Fit for purpose.

---

## What Phase 2 must deliver (priority order)

1. **A Lunova visual language** — typographic personality, a real elevation/depth system, one signature motion, the celestial motif as identity not decoration, the `--moonlight` accent given a job (music).
2. **Discovery redesigned** — full-photo carousel; personality line at top; music & movement as *native identity blocks*; a "why you might click" payoff; a surfaced opener hint; card transitions.
3. **Match moment** — elegant reveal with motion, one meaningful connection, effortless entry to chat.
4. **Conversation** — a persistent "you matched through …" context strip; warmer empty state seeded with the shared highlights.
5. Then: real-time messaging (`RealtimeProvider`), security audit, CI, deployment, real providers, i18n, observability.
