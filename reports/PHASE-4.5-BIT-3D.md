# Phase 4.5 — BIT 3D mascot prototype

## 1. Verdict

`AWAITING VISUAL APPROVAL`

The isolated lab builds and the automated checks pass. The mascot is a procedural prototype. It is not visually approved, and it is not the final production model.

## 2. UTC timestamp

`2026-09-30T17:57:23Z`

## 3. Branch

`main`

## 4. HEAD

`0a84c6a` (`feat: complete heybit phase 4 reaction pipeline`). Phase 4.5 changes are uncommitted.

## 5. Initial state

The web app was the Phase 1 placeholder. It had no Three.js stack, no mascot component, and no logo file in the repo. Runtime state was left untouched.

## 6. Files changed

- `apps/web/components/bit/bit-mascot.constants.ts`
- `apps/web/components/bit/bit-mascot.state.ts`
- `apps/web/components/bit/BitScene.tsx`
- `apps/web/components/bit/BitMascot3D.tsx`
- `apps/web/components/bit/BitLab.tsx`
- `apps/web/app/lab/bit/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/public/brand/bit-mark.svg`
- `apps/web/public/models/.gitkeep`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `scripts/bit-mascot.test.ts`
- `docs/BIT_3D_SPEC.md`
- `package.json`
- `package-lock.json`
- `reports/PHASE-4.5-BIT-3D.md`

## 7. 3D stack

`three` 0.186, `@react-three/fiber` 9.8, `@react-three/drei` 10.7. No physics and no animation library. The canvas is loaded in the browser only.

## 8. Model strategy

`PROCEDURAL PROTOTYPE`

There is no BIT GLB in the repo. The lab builds the mark from blocks. A later file can replace it at `/models/BIT.glb` if it keeps the node names `Body`, `Eye_L`, `Eye_R`, `Pixel_01`, and `Pixel_02`.

## 9. Body geometry approach

Hard-edged boxes from the shared silhouette map. Body depth is 0.62 units, enough to read from the side without overpowering the front. There is no smooth surface, mouth, limbs, or text.

## 10. Front-view fidelity approach

The block map keeps the stepped body, two vertical eye openings, two detached pixels at the upper left, and an off-center lower notch. The outline is not mirrored. The same map is drawn in `/brand/bit-mark.svg`. This is an interpretation of the written mark, not a trace of a missing source file.

## 11. Eye implementation

`Eye_L` and `Eye_R` are near-black boxes set just behind the front face. They can shift and compress slightly. There are no pupils, brows, or a mouth.

## 12. Floating-pixel implementation

`Pixel_01` and `Pixel_02` stay near their logo positions at rest and drift on their own. BUSY, BURN, and DEX_PAID move them more. They are not a particle system.

## 13. Materials

Body and pixels use off-white `#f3f0e8`, roughness 0.78, and a very low warm emissive. Eyes are near-black with roughness 0.96. No chrome, gloss, or green/red trading colors.

## 14. Lighting

Near-black void, one warm key light, one dim cool rim, and a low ambient fill. The page adds a soft radial glow. There is no HDRI and no bloom postprocessing.

## 15. Animation-state implementation

`sampleMascotPose()` drives position, rotation, eye scale, pixel offset, emissive, and scale. `BitMascot3D` accepts `state`, `intensity`, `reducedMotion`, and `className`. It does not take raw trades.

## 16. State transition behavior

`IDLE` and `BUSY` hold. `NOTICE`, `BUY`, `SELL`, `BURN`, and `DEX_PAID` play once and then settle to the idle pose. BUY lifts. SELL dips. Neither changes the body color.

## 17. Intensity behavior

Values are clamped from 0 to 1. On `BUSY`, a higher intensity increases the pixel orbit and the light pulse. The lab slider is manual. It is not connected to live activity.

## 18. Reduced-motion behavior

`prefers-reduced-motion: reduce` stops the looping motion and keeps a static pose. The lab checkbox can force that mode. It cannot turn motion back on while the system requests reduced motion.

## 19. Responsive camera strategy

Desktop is a slight 3/4 view. Tablet pulls back. Widths under 700px move closer to a front view and farther out so the body is not cropped. Pointer parallax is tiny, desktop only, and off during reduced motion. Debug orbit is off unless the lab checkbox is on.

## 20. Fallback strategy

If WebGL is missing, or before it is detected, the lab shows `/brand/bit-mark.svg`. The same image is in a `noscript` tag. The server-rendered lab HTML includes that mark and the state controls.

## 21. Performance considerations

Device pixel ratio is capped at 1.5. There are no textures and no postprocessing. The body and each eye are instanced meshes. The canvas chunk is loaded only on the lab route. `/lab/bit` is a static page. The homepage is unchanged.

## 22. `/lab/bit` route

`http://localhost:3000/lab/bit` when the web app is running. It has the mascot, the seven state buttons, an intensity slider, reduced motion, debug orbit, and camera reset. It does not call Supabase, OpenAI, Alchemy, or a wallet.

## 23. Typecheck result

`PASS`

## 24. Lint result

`PASS`

## 25. Test result

`PASS`. 71 tests, including the mascot contract, intensity clamp, reduced motion, state return to idle, silhouette rules, fallback path, and the lab source check.

## 26. Build result

`PASS`. `/` stays dynamic. `/lab/bit` is static.

## 27. Manual visual-review instructions

Run the web app and open `/lab/bit`. Review it at 1440px, 1024px, and 390px. Switch through `IDLE`, `NOTICE`, `BUY`, `SELL`, `BUSY`, `BURN`, and `DEX_PAID`. This report does not treat that review as done.

A local production server was used only to confirm both routes return HTTP 200, the homepage still shows the development foundation, and the lab HTML contains the state controls and the static mark. The WebGL scene itself was not visually approved.

## 28. Any operator action required

From the repo root:

```bash
npm run dev --workspace=@heybit/web
```

Open `/lab/bit` and review the prototype at the three widths and seven states.

## 29. Explicit confirmations

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
