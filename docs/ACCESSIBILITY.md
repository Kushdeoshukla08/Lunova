# Accessibility

Target: WCAG 2.2 AA for the core journey — onboarding, discovery, profile,
match, messaging, modals, settings.

## What's in place

| Area | How |
| --- | --- |
| **Keyboard** | Every control is a real `<button>`/`<a>`/`<input>`. Global `:focus-visible { outline: 2px solid var(--glow); outline-offset: 2px }` — one consistent, high-contrast focus ring everywhere. Skip-to-content link is the first tab stop. |
| **Modals** | Native `<dialog>` + `showModal()` — the platform gives focus trapping, focus restore on close, `Esc` to dismiss, and the backdrop. `aria-labelledby` / `aria-describedby` wired (and not left dangling in `bare` mode). |
| **Screen readers** | All buttons/links have a text or `aria-label` name; all form inputs have an associated `<label>`; all `<img>` have `alt`; decorative SVGs are `aria-hidden`. Discovery's progress line is an `aria-live="polite"` region so advancing the deck is announced. |
| **Motion** | `@media (prefers-reduced-motion: reduce)` globally near-zeroes all animation/transition durations and disables smooth scroll. Entrance animations use `motion-safe:` so they never run when reduced motion is set. No autoplaying video; the only infinite animation (match-moment halo) is `motion-safe:` gated. |
| **Colour** | Every text/background pair the UI renders clears 4.5:1 in **both** themes, asserted against the real token values in `src/app/contrast.test.ts` rather than re-audited by hand. Status is never colour-only — badges carry text ("Verified", "Unverified"). |
| **Zoom / reflow** | Layout is flex/grid with relative units; 13 routes are asserted to reflow at 320 / 390 / 430 with no horizontal scroll (`tests/e2e/responsive-a11y.spec.ts`). |
| **Target size** | SC 2.5.8 (AA, 24×24) asserted across 13 routes. A `.tap-target` utility grows a small control's hit area with `::after` without changing its look, with a `--tap` override where a full 44px would overlap a neighbour. The `Checkbox` row is a `<label>` around both box and text, so the whole row is the target. Links inside a sentence are left alone — the criterion exempts them, and expanding them would make adjacent targets overlap. |
| **Menus** | The safety menu (block / report / unmatch) opens to its first item from the keyboard, moves with Arrow/Home/End, closes on `Esc` and restores focus to its trigger. Both trigger and menu are named with the subject. |
| **Form controls on iOS** | Controls are 16px on phones. Below that, Safari zooms the viewport on focus and does not zoom back — the layout ends up pinched mid-signup. The designed 0.95rem returns at `sm`. |
| **Headings** | One `<h1>` per page; sections use `<h2>`/`<h3>` in order. |
| **Language** | `<html lang>` is set (currently `en`; becomes the negotiated locale when a second ships — docs/I18N.md). |

## Known gaps / to verify with assistive tech

- **Full NVDA / VoiceOver pass** on the live staging URL — the checks above are
  code + DOM-tree review, not a real screen-reader run. This is a staging
  task (docs/USER-TESTING.md task 6 covers safety-control discoverability;
  a dedicated SR pass should run alongside).
- **Colour is checked at the token level, not per rendered pixel.** The test
  covers the pairs the UI actually draws; a new component that puts an existing
  pair together in a new way is covered, but a brand-new colour combination is
  only caught if it is added to the list.
- Discovery **swipe/tap-to-navigate photos** has button equivalents (Previous
  photo / Next photo) — confirm the arrow buttons are reachable and announced
  before the card body on mobile.
- **Voice control**: labels match visible text where there is visible text
  (good), but a few icon-only controls rely on `aria-label` that differs from
  any visible string — fine for SR, a note for voice-control users.

## How to re-check

- Keyboard: unplug the mouse, complete signup → onboarding → like → send a
  message → block, using only Tab / Shift-Tab / Enter / Space / Esc / arrows.
- Reduced motion: OS setting on, confirm the deck still advances and the match
  modal still appears (just without the flourish).
- Screen reader: NVDA (Windows) or VoiceOver (macOS) through the same journey;
  the "why you might click" reasons and the suggested opener must be read in a
  sensible order, before the "more about" detail.
- Automated: `axe` DevTools on `/discover`, `/onboarding/basics`, a conversation,
  and an open match modal.
