# Phase 5B — Production event wiring

## 1. Verdict

AWAITING FUNCTIONAL APPROVAL

## 2. UTC timestamp

2026-09-30T21:33:33Z

## 3. Branch

`main`

## 4. HEAD

`4894338 feat: place idle BIT on the dark homepage`

## 5. Working-tree status

Dirty and uncommitted. No commit. No push.

## 6. Files changed

- `apps/web/components/bit/BitProduction.tsx`
- `apps/web/components/bit/bit-visual.ts`
- `apps/web/components/bit/use-bit-visual.ts`
- `apps/web/lib/bit-visual-feed.ts`
- `apps/web/lib/public-supabase.ts`
- `apps/web/app/api/bit-visual/route.ts`
- `supabase/migrations/20260930221500_create_bit_visual_feed.sql`
- `scripts/bit-mascot.test.ts`
- `scripts/bit-visual.test.ts`
- `package.json`

Homepage copy, homepage CSS, mascot geometry, reaction choreography, and `bitmain.png` were not edited. The new SQL file was not applied.

## 7. Existing Phase 4 reaction pipeline discovered

The worker still classifies confirmed trades as BUY or SELL and stores them in `processed_transactions`. Priority events TOKEN_BURN and DEX_PAID still go through the reaction scheduler into `bit_reactions` as generated text rows. That pipeline was not rewritten. The homepage cannot read those tables directly: anon and authenticated have no grants on them. `bit_reactions` also does not store BUY versus SELL.

The production mascot now reads a narrow view, `bit_visual_feed`, that exposes only `cue_id`, `kind`, and `observed_at`. Trades contribute BUY and SELL. Generated TOKEN_BURN and DEX_PAID rows contribute BURN and DEX_PAID. Activity text is ignored. The view is select-only and does not change ledger or accounting meaning.

## 8. Production state owner

`BitProduction` asks `useBitVisualPose()` for the current pose and passes `state` and `intensity` into `BitMascot3D`. The pose comes from one visual controller. `BitMascot3D` and `BitScene` stay presentation-only. `page.tsx` has no timers and no hard-coded mascot state.

## 9. BUY mapping

A trade row with `event_type` BUY becomes visual kind BUY.

## 10. SELL mapping

A trade row with `event_type` SELL becomes visual kind SELL.

## 11. BURN mapping

A generated `bit_reactions` row with `reaction_type` TOKEN_BURN becomes visual kind BURN.

## 12. DEX_PAID mapping

A generated `bit_reactions` row with `reaction_type` DEX_PAID becomes visual kind DEX_PAID.

## 13. NOTICE mapping

NOTICE is a locked visual state. The live view does not invent notices from trades or activity text. The controller accepts a NOTICE cue for rehearsal and for a future real notice. None is synthesized today.

## 14. BUSY mapping

BUSY is held only while the controller is told that work is active. The live feed has no persisted busy flag, so production sets busy to false and intensity to 0. A timer alone never turns BUSY on. Intensity from a real signal is clamped to `[0, 1]`.

## 15. Priority rules

Queued one-shots are ordered BURN, then DEX_PAID, then BUY and SELL, then NOTICE. BUSY and IDLE are not queued events. An active one-shot always finishes its approved duration. A weaker cue cannot replace it, so NOTICE cannot cancel BURN. A stronger cue waits and plays next. Equal priority stays in arrival order. BUSY does not suppress a one-shot.

## 16. Duration and reset handling

Durations stay in `EVENT_DURATION_MS`: NOTICE 640, BUY 680, SELL 740, BURN 840, DEX_PAID 920. The controller samples one clock. It does not start a timer per event, and those numbers are not copied into the page. When elapsed time reaches the duration, the one-shot clears. If nothing else is queued and busy is off, the pose is IDLE.

## 17. BUSY resume behavior

A one-shot that starts during BUSY plays, then the pose returns to BUSY if busy is still set. Clearing busy after that returns to IDLE. Tested as BUSY → BUY → BUSY → BURN → BUSY → IDLE.

## 18. Duplicate-event handling

Each cue id is remembered. A repeated poll, reconnect, or the same snapshot does not play that id again. The first snapshot after mount is a baseline: those ids are remembered and not played, so history and a React strict-mode remount do not replay the board. The memory is capped at 200 ids.

## 19. Rapid-event handling

The pending queue holds 4 cues. Past that, the oldest lowest-priority cue is dropped. The mascot does not replay an unbounded backlog. BUY → BUY → SELL → BUY plays as four windows and then IDLE.

## 20. Failure and disconnect fallback

If the read throws, the view is missing, or the response is not available, the route returns `{ available: false, events: [], busy: false, intensity: 0 }` with `cache-control: no-store`. The hook then settles to IDLE. The mascot stays mounted on `/brand/bitmain.png`. There is no error card in the mascot area.

## 21. Lab isolation

`/lab/bit` still renders `BitLab` with manual state, replay, and loop. It does not import the live hook or `/api/bit-visual`. Production wiring cannot override those controls.

## 22. Reduced-motion behavior

`BitProduction` still follows `prefers-reduced-motion` and passes that flag into `BitMascot3D`. Event wiring stays on. The semantic pose still updates. Rendering stays on the already approved reduced-motion path.

## 23. Tests added

`scripts/bit-visual.test.ts` is in the root test script once. It covers the locked state list, the homepage no longer hard-coding IDLE, shared durations, BUY/SELL/BURN/DEX_PAID/NOTICE mapping, BUSY clamp and resume, duplicate suppression, baseline history, failure to IDLE, a bounded queue, priority, the required sequences, lab isolation, and the absence of writes from the feed, the route, and the mascot presentation. `scripts/bit-mascot.test.ts` now expects the production pose to come from the visual hook.

## 24. Rehearsal mechanism used

Phase 4 replay stays on the lab. Production rehearsal is a development-only clock inside the same controller. It is off unless the page is not a production build and the URL has `?bitRehearse=` set to a known sequence. There is no button, and the parameter does nothing in a production build. It performs no backend writes and no chain writes.

## 25. Rehearsal results

Controller traces, with no chain writes:

- `buy`: IDLE → BUY → IDLE
- `sell`: IDLE → SELL → IDLE
- `burn`: IDLE → BURN → IDLE
- `dex-paid`: IDLE → DEX_PAID → IDLE
- `notice`: IDLE → NOTICE → IDLE
- `busy`: IDLE → BUSY → IDLE
- `busy-buy`: IDLE → BUSY → BUY → BUSY
- `busy-burn`: IDLE → BUSY → BURN → BUSY
- `buy-sell-buy`: IDLE → BUY → SELL → BUY → IDLE

No sequence stayed stuck, grew the queue without bound, or replayed one id.

## 26. Typecheck result

`npm run typecheck` passed.

## 27. Lint result

`npm run lint` passed.

## 28. Test result

`npm test` passed. 82 tests, 0 failed.

## 29. Build result

`npm run build` passed after a clean `apps/web/.next`. Routes: `/` dynamic, `/api/bit-visual` dynamic, `/lab/bit` static. Homepage first-load JavaScript is about 109 kB.

## 30. Manual approval instructions

Run `npm run dev --workspace=@heybit/web`.

- `http://localhost:3000/` should still show the dark page, the mascot, “BIT is waking up.”, and the runtime and mint lines. This review saw `PRELAUNCH` and `not launched`. No activity tape, labels, or captions.
- Until `20260930181600_create_bit_reactions.sql` and `20260930221500_create_bit_visual_feed.sql` are applied by the operator, `/api/bit-visual` stays `available: false` and the mascot stays IDLE. This pass did not apply either migration.
- `http://localhost:3000/lab/bit` should still be the manual lab.
- Optional local sequences, development only: `/?bitRehearse=buy`, `sell`, `burn`, `dex-paid`, `notice`, `busy`, `busy-buy`, `busy-burn`, and `buy-sell-buy`.

Do not treat this report as approval.

## 31. Remaining functional concerns

Live BUY, SELL, BURN, and DEX_PAID cues cannot reach the homepage until the operator applies the unread reaction migration and the new select-only view. NOTICE and BUSY have no live source yet, so production will not show them until a real signal exists. The public reader was resolving one directory short of the repository root, so the web app was not loading the root local configuration. That path now matches the worker’s three-level climb. No environment values were changed.

## 32. Explicit confirmation

No deployment. No commit. No push. No Vercel or Render changes. No environment edits. No Supabase writes and no migration apply. No `bit_runtime` writes. No Solana writes. No token activation. No OpenAI calls.
