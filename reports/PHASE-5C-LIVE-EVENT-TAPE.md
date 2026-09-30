# Phase 5C — Live event tape

## 1. Verdict

AWAITING VISUAL APPROVAL

## 2. UTC timestamp

2026-09-30T21:55:28Z

## 3. Branch

`main`

## 4. HEAD

`4894338 feat: place idle BIT on the dark homepage`

## 5. Working-tree status

Dirty and uncommitted. Phase 5B’s visual feed is still uncommitted in this tree, and this tape is built on it. No commit. No push.

## 6. Files changed

Phase 5C:

- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/components/bit/BitEventTape.tsx`
- `apps/web/components/bit/bit-tape.ts`
- `apps/web/components/bit/use-bit-visual.tsx`
- `scripts/bit-tape.test.ts`
- `package.json`

The hook file moved from `.ts` to `.tsx` so the shared provider can render. Mascot geometry, reaction choreography, durations, and priorities were not edited.

## 7. Feed architecture used

One client provider, `BitVisualFeed`, reads `GET /api/bit-visual`. The mascot controller and the tape both use that snapshot. The tape does not read Supabase and does not call the chain.

## 8. Whether polling was shared or duplicated

Shared. There is one fetch of `/api/bit-visual`, still every 2 seconds. The tape does not start a second feed poll. Relative ages advance on a local one-second clock.

## 9. Tape placement

Under the homepage status lines:

```text
BIT
BIT is waking up.
runtime / mint status
LIVE
event rows
```

The label is the small word LIVE. There is no section headline.

## 10. Event fields shown

Kind and relative age. Labels are BUY, SELL, BURN, and DEX PAID. NOTICE and BUSY are not shown.

## 11. Amount support decision

No amounts. The verified feed exposes cue id, kind, and observed time only. Inventing SOL or token quantities was skipped.

## 12. Ordering

Newest observed time first.

## 13. Dedupe behavior

Rows are keyed by the existing cue id. A repeated poll of the same id does not add a second row. The first snapshot is remembered and is not announced again.

## 14. Row limit

5. Older rows drop off. There is no pagination and no scrolling ledger.

## 15. Entry animation

A new row, after the first snapshot, fades in and moves up by 0.2rem over 220ms. The motion rule is inside `prefers-reduced-motion: no-preference`, so reduced motion does not run it.

## 16. Empty state

`Waiting for activity…`

This review’s live feed was available and empty, and the homepage showed that line.

## 17. Unavailable state

`Live feed unavailable.`

Confirmed by blocking `/api/bit-visual`. No raw error and no alert box. The mascot path is unchanged.

## 18. Desktop result

At 1440px the tape is a 22rem monospace column under the status block, centered with the hero. Four sample rows fit on one line each. No horizontal overflow.

## 19. Tablet result

At 1024px the same column narrows to 20rem. Kinds and ages stay on one row. No overflow.

## 20. Mobile result

At 390px the column narrows to 16rem. BUY, SELL, BURN, and DEX PAID stay readable, with the age on the right. No sideways scroll.

## 21. Reduced-motion behavior

Entry motion is not applied when reduced motion is requested. The rows still render. The mascot still receives the reduced-motion flag it already had.

## 22. Accessibility behavior

The tape is a labelled section with an ordered list. A visually hidden polite live region announces a new kind only. It is not assertive, and the first snapshot is not announced. Age ticks do not sit in that live region.

## 23. Lab isolation

`/lab/bit` does not render the tape. The manual lab controls are unchanged.

## 24. Typecheck result

`npm run typecheck` passed.

## 25. Lint result

`npm run lint` passed.

## 26. Test result

`npm test` passed. 85 tests, 0 failed.

## 27. Build result

`npm run build` passed. `/` is dynamic. Homepage first-load JavaScript is about 110 kB. `/lab/bit` stays static.

## 28. Manual review instructions

Run `npm run dev --workspace=@heybit/web` and open http://localhost:3000/.

The live feed is currently available and empty, so the tape should read “Waiting for activity…”. Development-only layout fixtures, off in production:

- `/?bitTape=preview` shows BUY, SELL, BURN, and DEX PAID with ages. It does not drive the mascot.
- `/?bitTape=empty` shows the empty line.
- `/?bitRehearse=buy` still runs the existing reaction rehearsal, and that BUY also appears on the tape.

Check 1440, 1024, and 390, and confirm http://localhost:3000/lab/bit has no tape.

## 29. Remaining visual concerns

Headless review did not draw the WebGL mascot, so the character’s presence above the tape still needs eyes on a normal display. The live feed had no rows during this pass, so a real BUY or SELL on the page is not yet visible. No amounts are shown.

## 30. Explicit confirmation

No deployment. No commit. No push. No Vercel or Render changes. No environment edits. No Supabase writes. No Solana writes. No token activation. No OpenAI calls.
