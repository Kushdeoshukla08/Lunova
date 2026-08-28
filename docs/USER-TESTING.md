# Pre-launch usability test plan

A moderated test to run with 6–8 participants before opening signups. Goal: does
a real person, alone, get from "what is this" to "I have someone worth talking
to" — and does it feel different from the apps they already use?

## Recruiting

Mix across:

- **Life stage / intent:** one looking for something serious, one "figuring it
  out", one who mainly wants activity partners / friends.
- **Signal richness:** someone with strong music taste, someone whose identity
  is movement (and explicitly a *walker / yoga*, not a runner), someone with
  little of either who leans on interests and prompts.
- **App fatigue:** at least two people actively tired of Tinder/Hinge/Bumble.
- **Device:** at least half on their own phone.
- Exclude anyone who has seen the product or knows it's ours.

## Personas to have seeded in the test DB

So every participant lands in a populated feed:

| Persona | Shape | Tests |
| --- | --- | --- |
| Maya | photos + music (Big Thief, Fred again..) + hiking/yoga/cycling, long-term | the "rich overlap" card |
| Arjun | running/climbing, some shared music, nearby | music-match label + opener |
| Sol | strong music, no activity profile, "short term" | music-only card, intent gap |
| Noor | walker + yoga only, minimal music, "friends" | proves a non-athlete reads as fully represented |
| Devi | sparse profile, one prompt, few interests | low-overlap graceful degradation |

## Tasks (don't read the steps aloud — give the goal)

1. **First impression (no account).** "You've been sent this link. What is this,
   and who is it for?" — listen for whether the landing page lands.
2. **Get in.** Sign up and complete onboarding. *Watch for:* drop-off points,
   fields that feel intrusive, the photo step, the music/movement steps —
   does adding a walk feel as legitimate as adding a marathon?
3. **Find someone.** "Go through Discovery until you find someone you'd actually
   want to talk to." *Watch for:* do they read the card or try to swipe it? Do
   they notice "Why you might click"? Do they trust it? Does anyone ask "what's
   my match percentage" — and how do they react when there isn't one?
4. **Say something.** Start a conversation. *Watch for:* do they use the
   suggested opener, edit it, or write their own? Does the opener feel like them?
5. **The match moment.** (Facilitator triggers a mutual like from a seeded
   persona.) *Watch for:* reaction. Would they screenshot it?
6. **Safety.** "Someone's making you uncomfortable — deal with it." *Watch for:*
   can they find block/report without help? Does it feel within reach but not
   in their face?
7. **Leave and come back.** Close it, reopen. Do they know where they were?

## What to measure

- **Task completion** (unaided / aided / failed) per task.
- **Time to first meaningful action** — signup start → first sent message.
- **Comprehension:** in their words, why did a given person appear? (Compare to
  `/admin/why` for that pair — did the product tell the truth understandably?)
- **The differentiator, unprompted:** do they compare it to Tinder/Hinge/Bumble
  themselves? Favourably?
- **SUS** (System Usability Scale) at the end.
- **One question:** "Would you tell a friend about this? What would you say?"

## Success criteria (pre-launch bar)

- ≥ 6/8 complete tasks 1–4 unaided.
- ≥ 6/8 can explain, unprompted, *why* a specific person was shown.
- 0/8 come away thinking it's "another swiping app."
- The walker/yoga persona's owner does **not** feel second-class to the athletes.
- No participant needs help to block or report.
- Median SUS ≥ 75.

## After the test

- Fixes that block comprehension of *why* two people match, or that make
  Discovery feel like a swipe stack, are launch blockers.
- Everything else feeds the backlog with severity + the quote that surfaced it.
- Re-run tasks 1–4 with 3 fresh people after fixes land.
