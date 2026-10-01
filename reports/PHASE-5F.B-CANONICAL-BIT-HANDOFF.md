# Phase 5F.B — Canonical transparent BIT handoff

## 1. Verdict

AWAITING VISUAL APPROVAL

## 2. UTC timestamp

2026-10-01T07:47:38Z

## 3. Branch

`main`

## 4. HEAD

`f09f066 feat: drive homepage BIT from live events`

## 5. Working-tree status

Dirty and uncommitted. No commit. No push.

Phase 5D through 5F.A and the approved visual-feed migration comments were already in the tree. This phase did not edit the migration. Neither PNG was deleted or regenerated.

## 6. Files changed

- `apps/web/components/bit/bit-mascot.state.ts`
- `apps/web/components/bit/BitScene.tsx`
- `apps/web/components/bit/BitMascot3D.tsx`
- `apps/web/components/bit/BitProduction.tsx`
- `apps/web/app/globals.css`
- `scripts/bit-mascot.test.ts`
- `reports/PHASE-5F.B-CANONICAL-BIT-HANDOFF.md`

## 7. Mismatch analysis before changes

`bitmain2.png` is a 1080 square. Its opaque mark is 608×623 pixels, about 56.3% of the width and 57.7% of the height, centered 0.05% to the right and 0.93% below the square.

The WebGL grid is the same 23×24 trace. The shared camera framed that full grid at about 86% of the stage height, so the live mascot was roughly one and a half times larger than the fallback. That scale jump was the obvious swap.

Once both marks were compared inside the same box, overlap was about 0.90 with the eye holes treated as empty. Eyes, fragments, and the lower notch are the same drawing. The front face was already flat white. The desktop camera yaw was 2.58°, enough to show a thin side edge. The halo was a radial feather, not a rectangle.

## 8. Production-reference decision

`bitmain2.png` is the production reference. `bitmain.png` stays the lab comparison image. Geometry was not redrawn.

## 9. Fallback path

Production fallback and noscript remain `/brand/bitmain2.png`.

## 10. Camera changes

Production uses `cameraForProduction`. Yaw is 0.92° at 1440px, 0.69° at 1024px, and 0.46° at 390px. The lab camera is unchanged at 2.58° on desktop. Distance is unchanged, so depth is still there once the mascot turns.

## 11. Model transform changes

Production only. `productionMarkFit` scales the model to 0.675 and shifts it down by about 0.057 world units so the rest pose matches the PNG span. Reaction translations scale with that fit. Reaction angles do not.

## 12. Silhouette alignment changes

No new silhouette. The existing grid is scaled to the PNG's bounding box.

## 13. Eye alignment changes

No eye geometry change. The traced holes already match the transparent openings in `bitmain2.png`.

## 14. Fragment alignment changes

No fragment geometry change. Both pixels scale and move with the body, so their rest position stays locked to the PNG.

## 15. Lower-notch alignment changes

No notch edit. The feet stay part of the same scaled silhouette.

## 16. Front-face/material changes

None. The front plate stays unlit white. The side extrusion stays matte so depth still reads from the edge once the mascot moves.

## 17. Transparency verification

Renderer alpha stays on, clear alpha stays 0, and the scene still has no background color. The production stage background still computes to transparent. Review at 1440, 1024, and 390 showed no plate.

## 18. Halo changes

The halo gradient was not redrawn. On production it scales and shifts with the mark, so it does not stay large in the padding around the smaller pose. Opacity still follows the reaction.

## 19. Crossfade changes

The fallback and canvas still crossfade on opacity only. The duration is 140ms instead of 180ms. Reduced motion still skips the fade. There is no scale, blur, or mask.

## 20. Desktop result

At 1440×900 the stage stayed a 352px transparent square. The fallback was `/brand/bitmain2.png`. Statement, tape, and status were unchanged. Headless Chrome did not create a WebGL canvas, so the live 3D frame was not visible in this review.

## 21. Tablet result

At 1024×800 the stage stayed 320px, transparent, with the same fallback. No overflow.

## 22. Mobile result

At 390×844 the stage stayed 256px, transparent, with the same fallback. No sideways scroll. Production yaw is the smallest here.

## 23. Reduced-motion result

Reduced motion still uses the static pose, and that pose receives the same production fit, so the first WebGL frame should match the PNG without idle drift. The fade is skipped.

## 24. Reaction-regression result

State names, durations, priority, and the feed were not edited. BUY, SELL, BURN, DEX_PAID, and NOTICE durations remain 680, 740, 840, 920, and 640. Amplitudes still stack on the fitted pose.

## 25. Lab preservation

`/lab/bit` does not use the production camera or the production fit. Reference comparison still loads `/brand/bitmain.png`. Controls are unchanged. Without WebGL, the lab model pane shows the shared transparent fallback on the flat `#070708` field.

## 26. Typecheck result

Pass.

## 27. Lint result

Pass.

## 28. Test result

Pass. 92 tests, 0 failures.

## 29. Build result

Pass. `/` remains 3.83 kB with a 112 kB first load. `/lab/bit` remains 1.3 kB.

## 30. Manual review instructions

Dev server: http://localhost:3000/

Hard-refresh `/` at 1440, 1024, and 390. Watch the PNG become the 3D mascot. The target is that the swap is barely noticeable.

Then open:

```text
/?bitRehearse=buy
/?bitRehearse=sell
/?bitRehearse=burn
/?bitRehearse=dex-paid
/?bitRehearse=notice
/?bitRehearse=busy
```

Confirm the reactions still read clearly. Then open `/lab/bit` and confirm the original logo is still the comparison image.

Headless review cannot draw the WebGL mascot, so the handoff itself still needs a normal display.

## 31. Remaining visual concerns

The PNG edge is antialiased and the grid is hard, so a 140ms dissolve can still show a one-pixel fringe. The side extrusion is still present at under one degree of yaw. Confirm on a normal display that this does not read as a different BIT.

## 32. Explicit confirmation

No deployment. No push. No commit. No Vercel or Render change. No Supabase write. No migration edit. No runtime write. No Solana write. No token activation. No environment change. No OpenAI or other AI call. No new route, poll, or UI. No geometry redraw. No reaction-duration or priority change. Neither PNG was regenerated.
