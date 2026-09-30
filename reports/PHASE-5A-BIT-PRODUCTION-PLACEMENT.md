# Phase 5A — Production placement of BIT

## 1. Verdict

AWAITING VISUAL APPROVAL

## 2. UTC timestamp

2026-09-30T19:51:33Z

## 3. Branch

`main`

## 4. HEAD

`424d986 feat: add the BIT visual lab and stronger reactions`

## 5. Working-tree status

Dirty and uncommitted. Phase 5A is not committed. No push.

## 6. Files changed

- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/components/bit/BitMascot3D.tsx`
- `apps/web/components/bit/BitProduction.tsx`
- `scripts/bit-mascot.test.ts`

`apps/web/public/brand/bitmain.png` was not modified. Geometry, eye loops, and reaction curves were not modified.

## 7. Homepage structure before integration

`/` was one centered column, max width 40rem. It showed an eyebrow, the heading "Development foundation", and three status lines. There was no hero, no CTA, and no decorative visual. The page is still that column. BIT was added above the existing copy.

## 8. Production component

`BitProduction` is a thin wrapper around the existing `BitMascot3D`. It does not copy geometry or animation. It sets the production size class, listens for reduced motion, and renders the canonical mark in `noscript`.

The shared mascot now keeps the PNG in the box and fades the canvas in after the scene is created. That avoids swapping the box when WebGL becomes ready. The lab uses the same component.

## 9. Desktop placement

At 1440px, BIT is a 22rem square, centered in the existing column, above the copy. It is on screen with the heading. It does not cover the text. The page is still a text column, not a game view.

## 10. Tablet placement

Below 1100px the square is 20rem. The copy stays underneath. The camera path is unchanged, so the view sits closer to front as the canvas gets narrower.

## 11. Mobile placement

Below 700px the square is 16rem. It stays inside the column, does not fill the viewport, and leaves the copy below it. Fragments and the lower notch stay inside the mark.

## 12. Container sizing and headroom

The stage is square so the PNG and the opaque canvas occupy the same box. The approved camera margin is what leaves room for later BUY, SELL, and BURN travel. Reaction amplitudes were not reduced. The stage does not clip, and it is much smaller than the lab viewport.

## 13. Fallback and loading

The first paint is `/brand/bitmain.png`. If WebGL is missing, that image stays. When the scene is ready, the canvas fades in over the same box. Reduced motion skips the fade. `noscript` repeats the same PNG. There is no second fallback asset and no spinner.

## 14. Pointer behavior

The production figure uses `pointer-events: none`. It does not take clicks or block scrolling. There is no click action. The existing window parallax is still subtle, and it still turns off under reduced motion and below 768px.

## 15. Reduced motion

`BitProduction` follows `prefers-reduced-motion: reduce` and passes that into the mascot. Idle bob and fragment drift stay off. The pose stays the approved static idle pose.

## 16. Lab preservation

`/lab/bit` still has comparison modes, the state buttons, overlay, replay, loop, intensity, the reference PNG, and debug orbit. Those controls are not on the homepage.

## 17. Production state

Production BIT is hard-set to `IDLE`. Intensity is 0. Nothing on the homepage plays BUY, SELL, BURN, DEX_PAID, BUSY, or NOTICE.

## 18. Event wiring

No transactions, token events, feeds, queues, WebSockets, Solana calls, or reaction pipeline hooks were added. The homepage still reads the existing public runtime line. That read was already there.

## 19. Bundle and build impact

`/` is still dynamic. `/lab/bit` is still static. No new routes.

Homepage page JS is 482 B, first load about 108 kB. Before this phase the homepage first load was about 103 kB. The extra weight is the placement shell. `three` stays in the lazy scene chunk. `/lab/bit` first load stays about 109 kB.

## 20. Typecheck

PASS. `npm run typecheck` completed with no errors.

## 21. Lint

PASS. `npm run lint` completed with no errors. The final web build linted again after the square stage change.

## 22. Test

PASS. `npm test` — 73 tests, 0 failures. The new test checks that the homepage renders `BitProduction`, that production uses `BitMascot3D` at `IDLE`, that the canonical mark and reduced motion remain, that the lab route remains, and that the production wrapper has no backend or event wiring.

## 23. Build

PASS. `npm run build` completed, and `@heybit/web` was built again from the final source. Routes are `/`, `/_not-found`, and `/lab/bit`. No backend routes were added.

## 24. Manual review instructions

Run:

```bash
npm run dev --workspace=@heybit/web
```

Open `http://localhost:3000/` at 1440px, 1024px, and 390px. Confirm BIT sits above the existing copy, does not cover it, does not shift when the canvas appears, and stays idle. Then open `/lab/bit` and confirm the review controls are unchanged.

A headless check of the fallback layout was done at those widths. It did not exercise the WebGL crossfade, because GPU rendering was disabled. That still needs your eyes.

## 25. Remaining visual concerns

The homepage background is white. The canonical mark and the 3D scene are near-black, so BIT reads as a dark square above the copy. That square is the mark itself, not a new frame. Whether that feels native on this page is a visual call. Live reactions are intentionally absent until Phase 5B.

## 26. Confirmation

No deployment. No push. No Vercel, Render, or Supabase changes. No environment changes. No runtime writes. No Solana writes. No token activation. No OpenAI calls. No backend behavior changes. No new mascot states. `bitmain.png` was not edited. Approved geometry and reaction choreography were not edited.
