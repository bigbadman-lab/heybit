# Phase 4.5B — BIT visual fidelity lock

## 1. Verdict

`AWAITING VISUAL APPROVAL`

The front view was tightened against `bitmain.png`. Automated checks pass. The mascot is not visually approved.

## 2. UTC timestamp

`2026-09-30T19:14:20Z`

## 3. Branch

`main`

## 4. HEAD

`0a84c6a` (`feat: complete heybit phase 4 reaction pipeline`)

## 5. Working-tree status

Uncommitted. Phase 4.5, Phase 4.5A, and Phase 4.5B are all in the working tree. Nothing was committed or pushed.

## 6. Files changed

- `apps/web/components/bit/bit-mascot.eyes.ts`
- `apps/web/components/bit/bit-mascot.state.ts`
- `apps/web/components/bit/BitScene.tsx`
- `apps/web/components/bit/BitLab.tsx`
- `apps/web/app/globals.css`
- `docs/BIT_3D_SPEC.md`
- `scripts/bit-mascot.test.ts`
- `reports/PHASE-4.5B-BIT-VISUAL-LOCK.md`

`apps/web/public/brand/bitmain.png` was not rewritten.

## 7. Eye changes

Each eye is now its own stepped polygon, traced from the dark openings in the PNG. The left eye keeps its inner step. The right eye keeps its uneven outline instead of a clean rectangle. Neither eye is an oval, and neither has a pupil. The openings are cut through one body, and the black fill sits flat in those holes.

## 8. Silhouette changes

The body stays one extruded pixel mark from the Phase 4.5A grid. It was not split back into cubes, and it was not smoothed. The eye area is part of that solid, with the traced openings cut out.

## 9. Lower-notch changes

The shallow central gap and the two broad, unequal feet are unchanged. They still come from the PNG trace, not from a leg shape.

## 10. Detached-fragment changes

Both fragments stay on the traced rest positions: the larger stepped piece above, the smaller piece lower and further left. Idle drift is smaller, so that arrangement stays readable. Reduced motion leaves them exactly at rest.

## 11. Front-face and material changes

A flat white plate covers the front. It is unlit, so the face stays uniform white. The extrusion behind it is matte, with zero metalness, and only the side edge carries the depth. No bloom, texture, scratch, or body gradient was added.

## 12. Depth changes

Body depth stays `0.26`. It was not increased.

## 13. Camera changes

Desktop yaw is about 2.6 degrees. Tablet is closer to straight-on. Mobile is almost straight-on. Pointer parallax is small enough that it does not reshape the logo.

## 14. Overlay changes

`OVERLAY` and `SPLIT` size `/brand/bitmain.png` from the same frame as the 3D camera, centered on the mascot, with the PNG aspect ratio kept. The overlay does not follow pointer movement or mascot animation. Overlay mode has a lab-only opacity slider, default `0.45`.

## 15. Animation changes

Idle bob, turn, blink, and fragment drift are smaller. Notice is a smaller turn, without a fragment shift. Buy is still a short lift. Sell is still a short dip. Busy is still the more active state, in a tighter range. Burn is still a white pulse. DEX paid is still a short light sweep. Reduced motion is still static. No states were added or renamed.

## 16. Responsive review

Checked at 1440, 1024, and 390 in `3D`, and at 1440 in `SPLIT` and `OVERLAY`. The body, both fragments, and the lower notch stayed in frame. The silhouette stayed recognizable. Mobile did not crop the mark or let the side depth take over.

## 17. Typecheck result

`npm run typecheck` passed.

## 18. Lint result

`npm run lint` passed.

## 19. Test result

`npm test` passed, 71 tests. The camera check now expects the smaller desktop yaw. Eye loops are checked as two separate stepped outlines.

## 20. Build result

`npm run build` passed. `/` stayed dynamic. `/lab/bit` stayed static.

## 21. Manual review instructions

```bash
npm run dev --workspace=@heybit/web
```

Open `http://localhost:3000/lab/bit`.

Compare `3D`, `REFERENCE`, `SPLIT`, and `OVERLAY` at 1440px, 1024px, and 390px. In `OVERLAY`, use the opacity slider to check the outline, eyes, notch, and fragments. Then switch through `IDLE`, `NOTICE`, `BUY`, `SELL`, `BUSY`, `BURN`, and `DEX_PAID`.

The approval question: does this look like the exact approved BIT logo, simply brought into shallow physical depth?

## 22. Remaining visual concerns

The eyes follow the PNG's stepped openings, and the PNG's soft edge still looks slightly softer than the hard cut. Overlay registration is close; a thin double edge can remain where the hard geometry meets the antialiased logo. The side rim is still visible at desktop yaw. This is not a GLB, and it is not approved.

## 23. Explicit confirmation

No deployment, Vercel change, Render change, Supabase write, runtime-state change, Solana write, token activation, environment change, OpenAI call, or backend behavior change was made. No secrets were printed.
