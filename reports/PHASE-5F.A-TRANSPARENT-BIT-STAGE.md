# Phase 5F.A — Transparent BIT stage

## 1. Verdict

AWAITING VISUAL APPROVAL

## 2. UTC timestamp

2026-10-01T07:27:16Z

## 3. Branch

`main`

## 4. HEAD

`f09f066 feat: drive homepage BIT from live events`

## 5. Working-tree status

Dirty and uncommitted. No commit. No push.

Phase 5D, 5E, 5F, and the approved visual-feed migration comments were already in the tree. This phase did not edit the migration. `bitmain.png` was not deleted or rewritten. `bitmain2.png` was already in the repo and its pixels were not changed.

## 6. Exact path of bitmain2.png

`apps/web/public/brand/bitmain2.png`

Served as `/brand/bitmain2.png`. It is a 1080×1080 RGBA PNG. The corners are fully transparent.

## 7. Files changed

- `apps/web/components/bit/bit-mascot.constants.ts`
- `apps/web/components/bit/BitMascot3D.tsx`
- `apps/web/components/bit/BitScene.tsx`
- `apps/web/app/globals.css`
- `scripts/bit-mascot.test.ts`
- `reports/PHASE-5F.A-TRANSPARENT-BIT-STAGE.md`

## 8. Production fallback changes

`BIT_FALLBACK_MARK` is now `/brand/bitmain2.png`. Production first paint, the WebGL-missing image, and the homepage `noscript` image all use that constant. `BIT_REFERENCE_PATH` stays `/brand/bitmain.png`.

## 9. Canvas/stage transparency changes

The production stage, canvas, canvas layer, and fallback image use a transparent background. The renderer is created with `alpha: true`, and the clear color alpha is 0. The scene no longer attaches a solid `#070708` background. Homepage size is unchanged: 352px at 1440, 320px at 1024, and 256px at 390. The reaction slot is still 16px.

## 10. Halo changes

The existing halo was already a radial gradient that fades to transparent at the edge. Its scale and opacity choreography were not changed. With the canvas clear gone, that halo can sit on the page instead of inside an opaque rectangle.

## 11. Lab-reference decision

Lab reference, overlay, and the lab `noscript` image still use `/brand/bitmain.png`. The shared mascot fallback uses the transparent asset, so a missing WebGL context does not bring the grey plate back. The lab model stage keeps a flat `#070708` fill behind the transparent canvas so the comparison field stays the old clear color. The homepage does not use that fill.

## 12. Desktop result

At 1440×900 the stage background computed to transparent. The fallback image was `/brand/bitmain2.png`. BIT sat on the page background with no grey rectangle. The statement, tape, and status were unchanged. No horizontal overflow.

## 13. Tablet result

At 1024×800 the column stayed 20rem and the stage stayed a 320px square with a transparent background. No square edge and no overflow.

## 14. Mobile result

At 390×844 the column stayed 16rem and the stage stayed a 256px square. BIT floated on the page. No sideways scroll.

## 15. Loading/fallback result

Headless Chrome did not create a WebGL canvas, so the review showed the transparent PNG for the whole visit. That image has no plate. When the canvas does become ready, it fades in over 180ms and the fallback fades out on the same timing. Reduced motion still skips that fade. There is no opaque clear color to flash.

## 16. Reaction-regression check

Reaction timing, priority, event feed, and homepage order were not edited. Stage size and the reserved context slot did not change. `?bitRehearse=buy` still loads the same page shell.

## 17. Typecheck result

Pass.

## 18. Lint result

Pass.

## 19. Test result

Pass. 91 tests, 0 failures.

## 20. Build result

Pass. `/` remains 3.83 kB with a 112 kB first load. `/lab/bit` remains 1.3 kB.

## 21. Manual review instructions

Dev server: http://localhost:3000/

Review `/` at 1440, 1024, and 390. Confirm the live 3D character has no rectangular edge and that the fallback does not flash a grey square before the canvas appears. Then open `/lab/bit` and confirm reference comparison still uses the original logo.

Headless review cannot draw the WebGL mascot, so the 3D handoff still needs a normal display.

## 22. Remaining visual concerns

The 180ms handoff shows the transparent PNG and the transparent canvas together. If their silhouettes do not match exactly, a short ghost is possible. The lab reference image still has its own grey field, which is the original logo.

## 23. Explicit confirmation

No deployment. No push. No commit. No Vercel or Render change. No Supabase write. No migration edit. No runtime write. No Solana write. No token activation. No environment change. No OpenAI or other AI call. No geometry, choreography, composition, or event-wiring change. `bitmain.png` and `bitmain2.png` were not regenerated.
