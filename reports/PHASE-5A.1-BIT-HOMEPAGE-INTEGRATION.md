# Phase 5A.1 — Homepage visual integration around BIT

## 1. Verdict

AWAITING VISUAL APPROVAL

## 2. UTC timestamp

2026-09-30T20:03:26Z

## 3. Branch

`main`

## 4. HEAD

`424d986 feat: add the BIT visual lab and stronger reactions`

## 5. Working-tree status

Dirty and uncommitted. This pass sits on the uncommitted Phase 5A placement. No commit. No push.

## 6. Files changed

- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/components/bit/BitMascot3D.tsx`
- `scripts/bit-mascot.test.ts`

`bitmain.png`, mascot geometry, and reaction choreography were not edited.

## 7. Original visual problem

BIT sat in a near-black square on a white page, above copy that read as internal scaffolding.

## 8. Background changes

The homepage, including the area around the column, is now `#070708`, the same tone as the mascot canvas. There is no card, border, or radius. Once the canvas is up, its edge matches the page.

## 9. Hero composition

BIT stays centered above the copy. The column is unchanged in width. Spacing above BIT is tighter than the old 4rem page margin, and the statement sits close under the mascot. Production sizes stay 22rem, 20rem, and 16rem.

## 10. Copy changes

Visible copy is now:

```text
HEYBIT

BIT is waking up.

BIT runtime: …
Official mint: …
```

The runtime and mint values still come from the existing public read. "Development foundation" and "This is not the live BIT website." are gone. There is no CTA and no launch pitch.

## 11. Typography and status

`HEYBIT` stays the small uppercase eyebrow, in muted off-white. The statement is the only heading. Status lines are smaller, monospaced, and quieter. Primary text is `#f3f0e8`. No new font is loaded. No badges or status colors.

## 12. Desktop result

At 1440px the page is one dark field. BIT's box is reserved above the centered statement, and the heading plus both status lines sit with it in the first screen. The canvas edge is not a separate frame.

## 13. Tablet result

At 1024px the same centered stack remains. The stage is 20rem. No separate tablet layout.

## 14. Mobile result

At 390px the stage is 16rem, top spacing is tighter, and the copy stays under BIT without horizontal overflow. The mascot box does not fill the viewport.

## 15. Fallback and loading

The first paint is still `/brand/bitmain.png`. The canvas still fades in over that same box, and reduced motion still skips the fade. The PNG field is a few steps lighter than `#070708`, so a faint square can exist until the canvas covers it. The canvas itself matches the page.

## 16. Reduced motion

Unchanged. The homepage still follows `prefers-reduced-motion: reduce`, the idle pose stays static, and the fade is skipped.

## 17. Lab preservation

`/lab/bit` still has comparison modes, state buttons, replay, loop, intensity, and debug orbit. Homepage rules are scoped to `main.home`. The shared canvas is no longer a tab stop, so it does not sit in the keyboard order ahead of the lab controls.

## 18. Production state

BIT remains hard-set to `IDLE` with intensity `0`.

## 19. Event wiring

No BUY, SELL, BURN, DEX_PAID, BUSY, or NOTICE path was added. No feeds, sockets, or chain calls were added.

## 20. Typecheck

PASS.

## 21. Lint

PASS.

## 22. Test

PASS. `npm test` — 73 tests, 0 failures. The homepage test now expects the quieter copy and still requires the idle mascot, the canonical mark, and no event wiring.

## 23. Build

PASS. The web build still shows `/` as dynamic and `/lab/bit` as static. Homepage first load stays about 108 kB. Worker and shared builds passed. No new routes.

## 24. Manual review instructions

The dev server can stay on `http://localhost:3000/`. Review `/` at 1440px, 1024px, and 390px. Confirm the dark field and BIT read as one surface, the statement sits with the mascot, and the status lines remain readable. Then open `/lab/bit` and confirm the review controls are unchanged.

A headless capture could not draw the WebGL character. It did confirm the dark page, the reserved mascot slot, the new copy, and the lab controls.

## 25. Remaining visual concerns

The fallback PNG's own background is slightly lighter than the canvas, so the first moment can still hint at a square. Whether "BIT is waking up." is the right line is a visual and tone call. This report does not approve the composition.

## 26. Confirmation

No deployment. No commit. No push. No Vercel, Render, or Supabase changes. No environment changes. No runtime writes. No Solana writes. No token activation. No OpenAI calls. No new mascot states. `bitmain.png` was not edited. Geometry and reaction choreography were not edited.
