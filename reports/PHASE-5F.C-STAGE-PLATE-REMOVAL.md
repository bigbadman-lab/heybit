# Phase 5F.C — Remove remaining stage plate

## 1. Verdict

AWAITING VISUAL APPROVAL

## 2. UTC timestamp

2026-10-01T08:00:58Z

## 3. Branch

`main`

## 4. HEAD

`f09f066 feat: drive homepage BIT from live events`

## 5. Working-tree status

Dirty and uncommitted. No commit. No push.

Phase 5D through 5F.B and the approved visual-feed migration comments were already in the tree. This phase did not edit the migration or either PNG.

## 6. Files changed

- `apps/web/components/bit/bit-mascot.state.ts`
- `apps/web/components/bit/BitScene.tsx`
- `scripts/bit-mascot.test.ts`
- `reports/PHASE-5F.C-STAGE-PLATE-REMOVAL.md`

## 7. Source of the visible stage plate

`bitmain2.png` has no rectangular veil. The production stage, canvas, and fallback are already transparent. The plate was the halo plane: 16 world units, then scaled with the mascot fit (0.675), which still left it about 10.8 units across. The stage is only about 6.1 units across, so the canvas clipped that glow into a square. At the clip, the old gradient still had visible alpha.

## 8. Stage-background changes

No new fill. The production wrapper, canvas, and fallback stay transparent. The scene still has no background color. Renderer alpha and clear alpha are unchanged.

## 9. Halo size changes

Production only. The resting glow diameter is 1.25 times the fitted body width. The texture reaches zero alpha at 70% of its radius, so the outer 30% of the stage matches the page. The strongest burn scale (1.32) still fades before the stage edge. The lab keeps the previous halo size.

## 10. Halo opacity changes

The production halo peaks at 0.14 and is 0.03 partway out, then zero. The lab halo stays at the previous 0.34 / 0.08 gradient. Reaction opacity is unchanged.

## 11. Transparency verification

At 1440, 1024, and 390 the production stage background computed to transparent. Sizes stayed 352, 320, and 256. No horizontal overflow. The fallback remained `/brand/bitmain2.png`.

## 12. Desktop result

At 1440×900 the stage is still a 352px transparent square. Headless Chrome did not draw the WebGL halo, so the clipped square itself was not visible in this review. The fit that removes it is the production halo scale above.

## 13. Tablet result

At 1024×800 the stage stayed 320px and transparent. The halo size is in world units, so the same containment applies.

## 14. Mobile result

At 390×844 the stage stayed 256px and transparent, with no sideways scroll.

## 15. Reaction-regression result

State names, durations, priority, and amplitudes were not edited. BUY, SELL, and DEX_PAID still scale the halo. BURN still reaches 1.32. That expanded glow is calculated to fade inside the stage rather than paint its edge.

## 16. Reduced-motion result

Reduced motion still uses the static pose. That pose gets the same small production halo. The stage stays transparent. The crossfade is still skipped.

## 17. Fallback/handoff result

The fallback is still `/brand/bitmain2.png`. The 140ms opacity crossfade was not changed. Production fit scale, camera yaw, and model offset were not changed.

## 18. Lab preservation

`/lab/bit` does not use the tight halo. Its comparison image is still `/brand/bitmain.png`. The lab model pane still has the flat `#070708` field.

## 19. Typecheck result

Pass.

## 20. Lint result

Pass.

## 21. Test result

Pass. 93 tests, 0 failures.

## 22. Build result

Pass. `/` remains 3.83 kB with a 112 kB first load. `/lab/bit` remains 1.3 kB.

## 23. Manual review instructions

Dev server: http://localhost:3000/

Look at `/` at 1440, 1024, and 390. The stage boundary should not read as a square. The halo should be a small soft blush behind BIT.

Then open:

```text
/?bitRehearse=buy
/?bitRehearse=sell
/?bitRehearse=burn
/?bitRehearse=dex-paid
/?bitRehearse=notice
/?bitRehearse=busy
```

BURN may widen the halo. It should still fade before the stage edge. Then open `/lab/bit`.

Headless review cannot draw the WebGL halo, so this check needs a normal display.

## 24. Remaining visual concerns

The burn halo is the widest. It is calculated to clear the stage edge, but the eye should confirm that on a normal display. The fallback PNG has no halo, so the blush appears only after WebGL is ready.

## 25. Explicit confirmation

No deployment. No push. No commit. No Vercel or Render change. No Supabase write. No migration edit. No runtime write. No Solana write. No token activation. No environment change. No OpenAI or other AI call. No scale, camera, geometry, layout, or reaction-timing change. Neither PNG was regenerated.
