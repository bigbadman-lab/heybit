# Phase 4.6 — BIT reaction strength

## 1. Verdict

AWAITING VISUAL APPROVAL

## 2. UTC timestamp

2026-09-30T19:36:15Z

## 3. Branch

`main`

## 4. HEAD

`0a84c6abc05899d8dc539e8d12a3fc88b88f44cb`

`feat: complete heybit phase 4 reaction pipeline`

## 5. Working-tree status

Dirty and uncommitted. This phase sits on top of the uncommitted Phase 4.5, 4.5A, and 4.5B visual work. No commit was created.

## 6. Files changed

Phase 4.6 edited:

- `apps/web/components/bit/bit-mascot.state.ts`
- `apps/web/components/bit/bit-mascot.constants.ts`
- `apps/web/components/bit/BitScene.tsx`
- `apps/web/components/bit/BitMascot3D.tsx`
- `apps/web/components/bit/BitLab.tsx`
- `apps/web/app/globals.css`
- `scripts/bit-mascot.test.ts`
- `docs/BIT_3D_SPEC.md`

`apps/web/public/brand/bitmain.png` was not modified.

## 7. Protected geometry confirmation

Unchanged: the canonical PNG, `BIT_ROWS`, eye loops, body extrusion, fragment rest positions, lower notch, body depth, front-face material, near-front camera, and the calm idle drift. No new states. No GLB.

## 8. BUY changes

680 ms. Short downward compression, then an upward pop with a small forward tilt and a slight roll. Eyes open on the pop. Fragments lag, then kick up and outward. The halo expands and settles. Body color stays white.

## 9. SELL changes

740 ms. A fast drop with a backward and sideways recoil, a brief squash, and narrowed eyes. Fragments stay up while the body falls, then follow back. A small recovery bounce returns the pose to idle. No red, and no new face.

## 10. BURN changes

840 ms. Inward compression, then a white flash, a short scale pop, and a halo shockwave. Fragments pull inward and snap outward. Eyes wash toward white during the flash, then return. No flame, smoke, or orange.

## 11. DEX_PAID changes

920 ms. A short pause, then a brighter front sweep, a small confident tilt, and a modest lift. Fragments flick once in sync. The halo pulses in scale. Eyes open briefly. No coins, gold, or text.

## 12. BUSY changes

Still holds. Low intensity is a faster bob, a small turn, and a tight fragment orbit. Higher intensity speeds that motion, widens the orbit, and blinks more often. The halo breathes. It does not shake.

## 13. NOTICE changes

640 ms. One turn toward attention, one eye beat, and a small fragment shift that way. Weaker than buy, sell, and burn.

## 14. IDLE changes

Idle bob, blink, fragment drift, and micro-turn are the previous calm layer. Busy motion is no longer mixed into that layer.

## 15. Motion and easing

Reactions are sampled in the existing frame loop. No animation library. Curves use anticipation, a fast ease-out impact, a small overshoot on the buy pop, and a smooth settle. Uniform scale stays within 0.93–1.08. Squash stays in that same band. Peak rotation is capped at 12 degrees. Viewports under 1100 px use 0.9 motion gain. Viewports under 700 px use 0.78.

## 16. Fragment choreography

Buy: lag, then lift. Sell: lag above the dropping body. Burn: inward, then outward. DEX paid: one coordinated flick. Busy: two offset orbits. Notice: a short shift toward the turn. All of them return to the PNG rest positions.

## 17. Halo and light

The existing radial halo scales and dims. Buy expands it. Sell tightens it. Burn scales it out as a shockwave and adds a soft front radial flash. DEX paid scales it once and runs a wider white sweep. Busy breathes it. No bloom pass, and no hue change. The idle halo texture is the previous gradient.

## 18. Reduced motion

Reduced motion is a static pose. No bob, orbit, squash, or large travel. Buy and sell keep a very small vertical offset and an eye difference. Burn, DEX paid, and busy keep a light change so the state is still readable. The lab still cannot override `prefers-reduced-motion: reduce`.

## 19. Lab changes

`/lab/bit` still opens on `SPLIT`, `IDLE`, intensity 0.2, and debug orbit off. Added a duration readout, a Replay button, and a Loop toggle for the selected action. `3D` remains the first comparison mode.

## 20. Responsive review

Automated sampling checks rotation, scale, squash, and fragment travel across each reaction. Smaller viewports reduce travel. This pass did not watch the canvas at 1440, 1024, or 390. That review is still yours.

## 21. Typecheck

PASS. `npm run typecheck` completed with no errors. The web project typecheck was run again after the reaction scene changes.

## 22. Lint

PASS. `npm run lint` completed with no errors. The production web build linted the final scene again.

## 23. Test

PASS. `npm test` — 72 tests, 0 failures. New coverage checks the state list, the canonical PNG path, reaction bounds, reduced motion, busy intensity, return to idle, and the absence of backend calls in the lab.

## 24. Build

PASS. `npm run build` completed, and `@heybit/web` was built again from the final source.

Homepage `/` remains dynamic, first load about 103 kB. `/lab/bit` is static, about 5.94 kB page JS and 109 kB first load.

## 25. Manual review instructions

Run:

```bash
npm run dev --workspace=@heybit/web
```

Open `http://localhost:3000/lab/bit`. Switch to `3D`. Replay `BUY`, `SELL`, `BURN`, `DEX_PAID`, and `NOTICE` at 1440 px, 1024 px, and 390 px. Set `BUSY` to intensity 0, 0.5, and 1. Confirm each reaction returns to the approved idle pose, and that the fragments stay in frame.

## 26. Remaining visual concerns

Strength is a judgment this report does not make. The fragment kicks are limited so the mark stays in frame, and they may still feel small once you see them. The DEX sweep is still a soft white band, not a new effect. This is still the procedural mascot, not a finished GLB.

## 27. Confirmation

No deployment. No commit. No push. No Vercel, Render, or Supabase changes. No runtime writes. No Solana writes. No token activation. No environment changes. No OpenAI calls. No backend or production reaction-semantic changes. `bitmain.png` was not edited. No new mascot states.
