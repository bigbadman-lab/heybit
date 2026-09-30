# BIT 3D spec

`apps/web/public/brand/bitmain.png` is the canonical BIT visual reference.

The lab mascot is a shallow 3D reading of that file. It is a fidelity prototype, not a separately designed character, and not the final production model.

## Front view

The front silhouette is the identity. At the default camera, BIT should read as the approved logo first and as a 3D object second.

Match the PNG for:

- overall width and height
- stepped outer contour
- asymmetry
- both eye openings, including their different shapes and placement
- the shallow central lower notch
- both detached upper-left fragments, including the gap and the diagonal relationship

Do not tidy the outline into a symmetric blob, rounded eyes, or legs.

## Depth

The body is one shallow extrusion of the pixel mark. Internal cube seams are not part of the design. The perimeter stays stepped. Eye openings are holes in that solid. The floating fragments are separate shallow solids so they can drift and return to the PNG arrangement.

Depth is only enough for an edge and a little parallax. A front-on view should barely show the side until BIT moves.

## Camera

The default camera keeps only a small yaw on desktop, and sits closer to straight-on on tablet and mobile. Framing keeps the fragments and the lower notch inside the view at 1440, 1024, and 390. The front face is a flat white plate. Depth shows on the side edge.

## Materials

- Body and fragments: luminous white, matte, almost no metal, a low warm emissive so the front stays close to the logo
- Eyes: near-black `#070708`, sitting just behind the front opening
- No chrome, toy gloss, neon color, or green/red trading colors

## Lighting and halo

A near-black void. A soft front key keeps the face close to the logo. A dim rim catches the extruded edge. A cheap radial halo sits behind the mark. There is no bloom postprocessing stack.

## Motion

States: `IDLE`, `NOTICE`, `BUY`, `SELL`, `BUSY`, `BURN`, `DEX_PAID`.

`IDLE` stays calm: a slow bob, an occasional blink, and a small fragment drift. `BUSY` holds and gets faster as intensity rises. `NOTICE`, `BUY`, `SELL`, `BURN`, and `DEX_PAID` each play once, with anticipation, a clear peak, and a short settle back to the idle pose. BUY pops upward. SELL drops. Neither state changes BIT's color. BURN is a white compression and flash. DEX_PAID is a light sweep with a small lift. Fragments lag the body, then return to the canonical resting layout. Peak scale stays near 0.93–1.08, and peak reaction rotation stays within about 12 degrees.

`prefers-reduced-motion` stops the looping motion and keeps a static pose. The lab can force that mode. It cannot turn motion back on when the system requests reduced motion.

## Comparison lab

`/lab/bit` can show `3D`, `REFERENCE`, `SPLIT`, or `OVERLAY`. Reference and overlay use `/brand/bitmain.png`. The lab opens on `SPLIT` in `IDLE`.

## Node names for a later GLB

```text
BIT.glb
├── Body
├── Eye_L
├── Eye_R
├── Pixel_01
└── Pixel_02
```

Expected public path: `/models/BIT.glb`. Replacing the extrusion later should keep the same component props: `state`, `intensity`, `reducedMotion`, and `className`.

## Performance

- device pixel ratio capped at 1.5
- no image textures on the mascot
- no postprocessing
- one merged body, one mesh per eye, one mesh per fragment
- the canvas is client-only

## Fallback

If WebGL is missing, or before it is detected, the lab shows `/brand/bitmain.png`. The page also includes that file in `noscript`.

## Not allowed

Do not turn BIT into a robot, a humanoid, a character with arms or legs, a smiling emoji, a glossy toy, a neon rainbow object, a green/red trading indicator, a cute children's mascot, a horror creature, or a mechanical character.
