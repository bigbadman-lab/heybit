# Phase 5F — Homepage composition lock

## 1. Verdict

AWAITING VISUAL APPROVAL

## 2. UTC timestamp

2026-10-01T07:02:33Z

## 3. Branch

`main`

## 4. HEAD

`f09f066 feat: drive homepage BIT from live events`

## 5. Working-tree status

Dirty and uncommitted. No commit. No push.

## 6. Approved pre-existing changes noted

Left untouched and treated as the required base:

- Phase 5D status and commentary
- Phase 5E reaction context
- The approved visual-feed migration comments in `supabase/migrations/20260930221500_create_bit_visual_feed.sql`

That migration file was not edited, reapplied, or replaced.

## 7. Files changed by Phase 5F

- `apps/web/app/globals.css` — spacing, type, and one shared column. This file already held uncommitted 5D and 5E styles.
- `package.json` — added `scripts/bit-composition.test.ts` once to the existing test list.
- `scripts/bit-composition.test.ts`
- `reports/PHASE-5F-HOMEPAGE-COMPOSITION-LOCK.md`

No component behavior, page order, feed, or mascot code was changed in this phase.

## 8. Hierarchy changes

The homepage now reads as one column in this order:

1. BIT
2. reaction context
3. HEYBIT / BIT is waking up.
4. live activity
5. factual status
6. commentary

The hero is tight. One larger gap separates the statement from the live tape. Telemetry sits closer to the tape than to the hero. Commentary sits a step below the facts.

## 9. Hero changes

Top padding is `clamp(0.75rem, 2.5vh, 1.5rem)`. BIT, the reserved context slot, the eyebrow, and the statement stay grouped. No card, border, or hero chrome.

## 10. Reaction-context integration

The slot is 1rem tall and the full column wide, with almost no gap under BIT. The label is 0.68rem mono, uppercase, tracking 0.18em, at 0.9 opacity. Labels, timing, and the active-cue source are unchanged. IDLE and BUSY still leave the slot blank. The slot height stayed 16px while labels appeared and cleared.

## 11. Statement changes

The words are unchanged: HEYBIT and BIT is waking up. The eyebrow is 0.68rem at 0.62 opacity. The statement is 1.2rem, weight 500, line-height 1.3, with 0.28rem above it. On a 390px width it is 1.1rem. No paragraph or subtitle was added.

## 12. Event-tape integration

The tape uses the shared column. Rows are tighter (0.22rem padding) and dividers are lighter (0.08 alpha). Kind text is quieter than the reaction label. Ages are tabular and muted. The LIVE label stays small. There is 1.7rem above the tape on desktop and 1.25rem at 390px. Row limit, kinds, and empty/unavailable copy are unchanged.

## 13. Telemetry integration

RUNTIME, MINT, STATE, and FEED stay. They share the tape's row rhythm and column width, with 0.85rem above the block (0.65rem at 390px). Values are 0.78 opacity so STATE does not match the reaction label's weight.

## 14. Commentary integration

Commentary stays a sans aside under the facts: 0.9rem, 0.68 opacity, 1rem above it, same column. No quotes, bubble, avatar, or icon.

## 15. Redundancy removed

No facts were deleted. Visual weight now separates them: the reaction label is the immediate cue, STATE is a quieter telemetry row, the tape is the recent list, and the commentary is a sentence rather than another data row. The old "BIT runtime:" and "Official mint:" lines stay absent.

## 16. Top-bar decision

No header. There is no navigation or interaction that needs one.

## 17. Background-treatment decision

Nothing added. The page stays `#070708`. The mascot plate is the existing stage, not a new page background.

## 18. Micro-interactions changed

None added. Existing context, tape, and commentary fades stay gated to `prefers-reduced-motion: no-preference`. No hover, glitch, parallax, shimmer, or background motion.

## 19. Color system

Near-black field, off-white statement, muted gray for system text. No green, red, orange, or colored cards. Reaction meaning stays in the label and in BIT's motion.

## 20. Typography system

Sans for the statement and commentary. Mono for the reaction label, tape, and telemetry. Sizes stay in a short range: 0.62rem labels, 0.68rem reaction, 0.72rem system rows, 0.9rem commentary, 1.2rem statement.

## 21. Width/alignment system

`main.home` sets `--bit-column`: 22rem, 20rem at 1100px, 16rem at 700px. The mascot, reaction slot, tape, and status block all use that column. The stage is square because it is 100% of the column with `aspect-ratio: 1`.

## 22. Desktop result

At 1440×900 the column is 352px. BIT starts 23px from the top and is a 352px square. The statement, empty tape, telemetry, and commentary all sit inside the first viewport. Commentary ends around 643px. No horizontal overflow. The feed was empty, so the tape read "Waiting for activity…". Runtime was PRELAUNCH, mint NOT LAUNCHED, state IDLE, feed LIVE after the first poll.

## 23. Tablet result

At 1024×800 the column is 320px. Same order, no overflow. Status and commentary end around 609px, inside the first viewport.

## 24. Mobile result

At 390×844 the column is 256px. Same order, no sideways scroll. Status and commentary end around 523px. Rows stay readable. BIT is smaller, not full-bleed.

## 25. Layout-stability result

The reaction slot stayed 16px tall for IDLE and for BUY, SELL, BURN, DEX PAID, and NOTICE. Those labels appeared and then cleared without moving the statement. BUSY left the slot blank. busy-buy showed BUY only during the one-shot and ended on BUSY with the context blank. busy-burn did the same for BURN.

## 26. Reduced-motion result

No new motion. Existing rules still remove the context transform, tape entry movement, commentary fade, and canvas fade when reduced motion is requested. Opacity remains available. No background animation exists.

## 27. Accessibility result

One `h1`: BIT is waking up. The reaction label stays `aria-hidden`; the polite live region is unchanged and is not assertive. The canvas stays `pointer-events: none` and `tabIndex={-1}`. System labels at 0.62 opacity on `#070708` remain above small-text contrast. No second poll and no new announcements were added.

## 28. Bundle/performance impact

No libraries, assets, fonts, or shaders. Production build:

- `/` 3.83 kB, first load 112 kB
- `/api/bit-visual` 122 B
- `/lab/bit` 1.3 kB, first load 109 kB

Shared first-load JavaScript remains 103 kB.

## 29. Lab preservation

`/lab/bit` still has no reaction context, tape, or status block. The lab column variable is unset. Review showed the lab controls, REFERENCE and SPLIT views, and the manual state buttons. Headless Chrome does not draw the WebGL mascot, so the 3D view still needs a normal display.

## 30. Typecheck result

Pass.

## 31. Lint result

Pass.

## 32. Test result

Pass. 91 tests, 0 failures. Includes `scripts/bit-composition.test.ts`.

## 33. Build result

Pass. `npm run build` completed for web, worker, and shared.

## 34. Manual review instructions

Dev server is on http://localhost:3000.

Review `/` at 1440, 1024, and 390, then:

```text
/?bitRehearse=buy
/?bitRehearse=sell
/?bitRehearse=burn
/?bitRehearse=dex-paid
/?bitRehearse=notice
/?bitRehearse=busy
/?bitRehearse=busy-buy
/?bitRehearse=busy-burn
```

Then open `/lab/bit`. Headless review confirmed layout and labels. Confirm the live 3D character on a normal display.

## 35. Remaining visual concerns

The live feed was empty, so the homepage tape is the waiting line. A preview fixture still renders BUY, SELL, BURN, and DEX PAID rows. Headless Chrome shows the PNG fallback inside the stage, not the WebGL mascot. The first viewport has unused black below the commentary; that is the bottom margin, and BIT is already at the top.

## 36. Explicit confirmation

No deployment. No push. No commit. No Vercel or Render change. No Supabase write. No migration edit or reapply. No runtime write. No Solana write. No token activation. No environment change. No OpenAI or other AI call. No new route, poll, wallet, chart, or trading control.
