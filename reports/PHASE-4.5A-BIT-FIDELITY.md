# Phase 4.5A — Exact logo fidelity and 3D polish

## 1. Verdict

`AWAITING VISUAL APPROVAL`

The lab now builds BIT as one shallow extrusion of `bitmain.png`, with a side-by-side comparison against that file. Automated checks pass. The mascot is not visually approved.

## 2. UTC timestamp

`2026-09-30T18:47:55Z`

## 3. Branch

`main`

## 4. HEAD

`0a84c6a` (`feat: complete heybit phase 4 reaction pipeline`). Phase 4.5 and Phase 4.5A changes are uncommitted.

## 5. Files changed

- `apps/web/components/bit/bit-mascot.constants.ts`
- `apps/web/components/bit/bit-mascot.geometry.ts`
- `apps/web/components/bit/bit-mascot.state.ts`
- `apps/web/components/bit/BitScene.tsx`
- `apps/web/components/bit/BitMascot3D.tsx`
- `apps/web/components/bit/BitLab.tsx`
- `apps/web/app/globals.css`
- `docs/BIT_3D_SPEC.md`
- `scripts/bit-mascot.test.ts`
- `reports/PHASE-4.5A-BIT-FIDELITY.md`

The canonical file `apps/web/public/brand/bitmain.png` was already in the repo and was not rewritten.

## 6. Canonical reference asset

`apps/web/public/brand/bitmain.png`, served as `/brand/bitmain.png`.

The earlier written block map is no longer the source. Where `bit-mark.svg` differs, the PNG wins. The lab fallback uses the PNG.

## 7. Geometry changes

The body is one extruded silhouette with the eye openings as holes. Each eye is one mesh. Each detached fragment is one mesh. The front face is a single solid, not a wall of separated cubes. The outer contour stays pixel-stepped.

## 8. Front-view fidelity changes

The block map was retraced from the PNG: wider body, stepped outline, asymmetric feet, both fragments, and both eyes. The default view is meant to read as the logo first.

## 9. Depth changes

Body depth is `0.26`, down from `0.62`. The side is a thin edge. Fragments and eyes are thinner than the body.

## 10. Camera changes

Desktop yaw is about 6 degrees. Widths under 1100 sit closer to straight-on, and widths under 700 closer still. The old strong three-quarter default is gone. Pointer parallax is smaller.

## 11. Eye changes

Eyes are the enclosed dark openings in the PNG, snapped to the same pixel grid as the body. They stay stepped. They are not ovals, pupils, or brows. They sit just behind the front opening.

## 12. Lower-notch changes

The bottom is one body with a shallow central gap and two wide feet. It is not a pair of narrow legs.

## 13. Detached-pixel changes

Both upper-left fragments from the PNG are present. The upper fragment is the larger stepped cluster. The lower fragment is the smaller block, down and to the left. Idle motion returns them to that rest layout.

## 14. Material changes

The body is white, matte, and slightly emissive, so the front stays bright on near-black. Roughness is high. Metalness is zero. Buy and sell do not change color.

## 15. Lighting and halo changes

The key light sits near the camera so the front stays even. A dim rim catches the extruded edge. A soft radial halo is drawn behind BIT on a small generated gradient. There is no bloom pass.

## 16. Animation-polish changes

Idle bob, turn, blink, and fragment drift are smaller and slower. Buy is a short lift. Sell is a short dip. Busy stays more active as intensity rises, within a smaller range. Burn is a white pulse. DEX paid is a brief light sweep. Reduced motion still holds a static pose.

## 17. Comparison-lab changes

`/lab/bit` opens on `SPLIT` and `IDLE`, with low intensity and debug orbit off. Modes are `3D`, `REFERENCE`, `SPLIT`, and `OVERLAY`. Reference and overlay use `/brand/bitmain.png`. Overlay is a centered transparent copy, not a calibrated registration.

## 18. Responsive behavior

Framing was checked at 1440, 1024, and 390. The fragments and the lower notch stayed in frame. Mobile stays closer to a front view. Depth does not take over the silhouette.

## 19. Fallback behavior

Missing WebGL, and the first paint before WebGL is known, shows `/brand/bitmain.png`. The noscript image uses the same file.

## 20. Typecheck result

`npm run typecheck` passed.

## 21. Lint result

`npm run lint` passed.

## 22. Test result

`npm test` passed, 71 tests. New checks cover the canonical PNG path, PNG fallback, comparison modes, default `IDLE`, clamped intensity, reduced motion, the unchanged state list, two eye holes, and no backend calls in the lab.

## 23. Build result

`npm run build` passed. `/` stayed dynamic. `/lab/bit` stayed a static route. Homepage first-load JavaScript stayed about 103 kB. The lab route is about 4 kB plus the shared runtime; the 3D code loads with the lab.

## 24. Manual review instructions

```bash
npm run dev --workspace=@heybit/web
```

Open `http://localhost:3000/lab/bit`.

Review `3D`, `REFERENCE`, and `SPLIT` at 1440px, 1024px, and 390px. `OVERLAY` is available as a rough check. Switch through `IDLE`, `NOTICE`, `BUY`, `SELL`, `BUSY`, `BURN`, and `DEX_PAID`.

The approval question: does the 3D mascot look like the approved BIT logo brought into physical depth?

## 25. Remaining visual concerns

The body, notch, and fragments now follow the PNG. The eyes are still the hardest part. The PNG eyes are antialiased, so they look softer than the hard pixel steps in the extrusion. The left eye has an inner step. The right eye reads more rectangular than the source. The front is bright, and it can still pick up a little shading the flat PNG does not have. Overlay alignment is approximate. This is not a GLB, and it is not approved.

## 26. Explicit confirmations

- no deployment
- no Vercel changes
- no Render changes
- no Supabase writes
- no runtime-state changes
- no Solana writes
- no token activation
- no OpenAI calls required
- no backend behavior changes
- no secrets printed
