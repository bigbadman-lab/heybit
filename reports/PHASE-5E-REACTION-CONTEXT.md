# Phase 5E — Reaction context layer

## 1. Verdict

AWAITING VISUAL APPROVAL

## 2. UTC timestamp

2026-10-01T06:28:45Z

## 3. Branch

`main`

## 4. HEAD

`f09f066 feat: drive homepage BIT from live events`

## 5. Working-tree status

Dirty and uncommitted. No commit. No push.

Phase 5D and the approved visual-feed migration comments were already in the tree. This phase did not edit the migration.

## 6. Files changed

Phase 5E:

- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/components/bit/BitReactionContext.tsx`
- `apps/web/components/bit/bit-reaction-context.ts`
- `scripts/bit-reaction-context.test.ts`
- `package.json`
- `reports/PHASE-5E-REACTION-CONTEXT.md`

`page.tsx`, `globals.css`, and `package.json` also still carry the uncommitted Phase 5D work.

## 7. Active-cue source

The line reads `feed.pose.state` from the existing shared visual feed. That is the same pose the mascot, status surface, and commentary already use. There is no second state machine and no new poll.

## 8. Labels implemented

NOTICE, BUY, SELL, BURN, and DEX PAID. IDLE renders nothing.

## 9. BUSY design decision

BUSY shows no reaction context. The commentary line already covers that stretch, and a second “PROCESSING” label would sit too close to it. During BUSY → BUY → BUSY and BUSY → BURN → BUSY, the label appears only for the one-shot and then clears.

## 10. Optional value support included or deferred

Deferred. The feed does not expose a trustworthy amount or unit. The line is the label only. No values were invented and no new view was added.

## 11. Placement

Directly under BIT and above “HEYBIT” / “BIT is waking up.” It is not in the tape, not in the telemetry block, and not over the mascot.

## 12. Timing synchronization

The label is on while the shared pose is that one-shot and gone when the pose returns to IDLE or BUSY. The controller still owns the duration. This layer has no timer of its own.

## 13. Transition behavior

A 160ms opacity fade, with a 0.12rem rise and a scale from 0.98 to 1. No bounce, typewriter, glitch, or color flash.

## 14. Reduced-motion behavior

Reduced motion keeps the label and uses opacity only. Translate and scale are turned off.

## 15. Layout-stability method

The slot is a fixed 1.15rem line. It stays reserved while idle so the statement does not jump, and it does not grow into a section.

## 16. Commentary integration

Commentary stays under the facts. The context line does not replace it and is not merged into it. Rehearsals still showed a personality line under the factual label.

## 17. Event-tape integration

The tape is unchanged and still lists recent events. The context line shows only the active reaction.

## 18. Status-surface integration

`STATE` remains in the telemetry block. The context line is the shorter label closer to BIT. The status rows were not removed.

## 19. Desktop result

At 1440px the label is centered under BIT. Idle keeps the short slot, with no horizontal overflow. BUY, SELL, BURN, DEX PAID, and NOTICE appeared with the reaction and cleared when it ended.

## 20. Tablet result

At 1024px the same slot stays centered. No clipping and no overflow.

## 21. Mobile result

At 390px the line stays one row inside a 16rem column. No sideways scroll. There is no amount to truncate.

## 22. Accessibility behavior

The visible label is hidden from the accessibility tree. A polite live region announces a cue once. The same cue is not announced again on later polls. It is not assertive.

## 23. Lab isolation

`/lab/bit` does not render the context line.

## 24. Typecheck result

`npm run typecheck` passed.

## 25. Lint result

`npm run lint` passed.

## 26. Test result

`npm test` passed. 90 tests, 0 failed.

## 27. Build result

`npm run build` passed. `/` is dynamic. Homepage first-load JavaScript is about 112 kB. `/lab/bit` stays static.

## 28. Manual review instructions

Run `npm run dev --workspace=@heybit/web` and open:

- `http://localhost:3000/?bitRehearse=buy`
- `http://localhost:3000/?bitRehearse=sell`
- `http://localhost:3000/?bitRehearse=burn`
- `http://localhost:3000/?bitRehearse=dex-paid`
- `http://localhost:3000/?bitRehearse=notice`
- `http://localhost:3000/?bitRehearse=busy`
- `http://localhost:3000/?bitRehearse=busy-buy`
- `http://localhost:3000/?bitRehearse=busy-burn`

Check 1440, 1024, and 390. Idle should show no label. Confirm http://localhost:3000/lab/bit has no context line.

## 29. Remaining visual concerns

Headless review did not draw the WebGL mascot, so the gap between the character and the label still needs a normal display. The live feed had no trades during this pass, so a real event was not on the line. Amounts are still omitted on purpose.

## 30. Explicit confirmation

No deployment. No commit. No push. No Vercel or Render changes. No environment edits. No Supabase writes. No Solana writes. No token activation. No OpenAI or other AI calls. No new route and no second poll.
