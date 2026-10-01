# Phase 5D — Market/runtime surface and BIT commentary

## 1. Verdict

AWAITING VISUAL APPROVAL

## 2. UTC timestamp

2026-10-01T06:17:49Z

## 3. Branch

`main`

## 4. HEAD

`f09f066 feat: drive homepage BIT from live events`

## 5. Working-tree status

Dirty and uncommitted. No commit. No push.

Approved pre-existing change, left untouched:

- `supabase/migrations/20260930221500_create_bit_visual_feed.sql`

The operator had already applied that migration. The two safety comments are still present and were not edited, reapplied, or replaced in this phase.

## 6. Files changed

Phase 5D:

- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/components/bit/BitStatus.tsx`
- `apps/web/components/bit/bit-commentary.ts`
- `apps/web/components/bit/bit-visual.ts`
- `apps/web/components/bit/use-bit-visual.tsx`
- `scripts/bit-commentary.test.ts`
- `scripts/bit-mascot.test.ts`
- `scripts/bit-tape.test.ts`
- `scripts/bit-visual.test.ts`
- `package.json`
- `reports/PHASE-5D-STATUS-COMMENTARY.md`

`bit-visual.ts` only exposes the cue already chosen by the existing controller, so a one-shot line can stay tied to that cue. Durations, priorities, and choreography were not changed.

## 7. Factual data sources used

Runtime and mint still come from `readPublicRuntime`. Visual state and feed availability come from the existing `BitVisualFeed` snapshot. No second poll and no new chain read.

## 8. Fields shown

```text
RUNTIME
MINT
STATE
FEED
```

This review showed `PRELAUNCH`, `NOT LAUNCHED`, `IDLE`, and `FEED LIVE` once the read returned. A missing runtime read shows `UNAVAILABLE` for runtime and mint. A known runtime with no mint shows `NOT LAUNCHED`.

## 9. Optional market fields included or deferred

Deferred. Price, liquidity, volume, holders, and market state are not in the current public read. None were invented.

## 10. Duplicate status presentation removed

The old “BIT runtime:” and “Official mint:” lines are gone. Those facts appear once, in the new surface.

## 11. Current-state integration

`STATE` is `feed.pose.state`, the same pose passed to the mascot. It is not inferred from CSS and it is not a second state machine.

## 12. Feed-status integration

`FEED` is `LIVE` when the shared snapshot is available, and `UNAVAILABLE` when that read fails. Before the first response it shows `…` rather than a false health value.

## 13. Commentary architecture

One local line under the facts. Static phrase pools plus a hash. No speech bubble, no AI, no external text service. Facts stay monospace. The line under them uses the page sans and stays quiet.

## 14. Phrase pools created

Six lines each for IDLE, NOTICE, BUY, SELL, BUSY, BURN, and DEX_PAID. Phrases are unique across states. Unknown states use the IDLE pool. If a pool were empty, the line is `still watching`.

## 15. Deterministic selection method

A fixed hash of the state and a seed. The same seed always returns the same line. Render and polling do not call `Math.random()`. One-shots are seeded by the active cue id. IDLE is seeded by a tick. BUSY uses one seed for the whole busy stretch.

## 16. Commentary timing and cooldown

A one-shot line is chosen when that cue starts and held until the cue ends. IDLE changes no sooner than every 20 seconds. BUSY keeps one line until busy ends.

## 17. Advisory-language safety review

Pools were checked against buy-now, sell-now, send-it, easy-money, guaranteed, price-prediction, bullish, bearish, and keep-buying language. None of those phrases are in the pools. The lines observe. They do not tell anyone what to do.

## 18. Desktop result

At 1440px the facts and the line sit in the same 22rem column as the tape, under it. No overflow. Runtime, mint, idle state, and a single commentary line were readable. The page stays sparse.

## 19. Tablet result

At 1024px the column narrows to 20rem. The same rows remain. No overflow.

## 20. Mobile result

At 390px the column narrows to 16rem and each fact stays one row: label left, value right. The commentary has space under the facts. No sideways scroll.

## 21. Reduced-motion behavior

The commentary fade runs only when reduced motion is not requested. Facts do not flash. The mascot’s existing reduced-motion flag is unchanged.

## 22. Event-tape integration

The tape stays above the status surface and still uses the one shared feed. Rehearsals moved `STATE` through BUY, SELL, BURN, DEX_PAID, NOTICE, and BUSY, and the commentary changed with those states, then returned to the same idle line.

## 23. Lab isolation

`/lab/bit` does not render the status surface or the commentary. Lab controls are unchanged.

## 24. Typecheck result

`npm run typecheck` passed.

## 25. Lint result

`npm run lint` passed.

## 26. Test result

`npm test` passed. 88 tests, 0 failed.

## 27. Build result

`npm run build` passed. `/` is dynamic. Homepage first-load JavaScript is about 111 kB. `/lab/bit` stays static.

## 28. Manual review instructions

The app is at http://localhost:3000/ if `npm run dev --workspace=@heybit/web` is running.

Development-only rehearsals, off in production:

- `/?bitRehearse=buy`
- `/?bitRehearse=sell`
- `/?bitRehearse=burn`
- `/?bitRehearse=dex-paid`
- `/?bitRehearse=notice`
- `/?bitRehearse=busy`

Check 1440, 1024, and 390. Confirm http://localhost:3000/lab/bit has no status block.

## 29. Remaining visual concerns

Headless review did not draw the WebGL mascot, so the character above this block still needs a normal display. The live feed had no events during this pass, so a real trade was not on the tape. Market numbers are still absent on purpose.

## 30. Explicit confirmation

The visual-feed migration had already been applied by the operator. Its two safety comments were preserved unchanged. Phase 5D did not reapply or modify that migration and did not add another one.

No deployment. No commit. No push. No Vercel or Render changes. No environment edits. No Supabase writes. No Solana writes. No token activation. No OpenAI or other AI calls.
