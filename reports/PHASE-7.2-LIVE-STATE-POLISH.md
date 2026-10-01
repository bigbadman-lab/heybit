# Phase 7.2 — Live-state polish

## 1. Verdict

AWAITING FUNCTIONAL APPROVAL

## 2. UTC timestamp

2026-10-01T12:10:48Z

## 3. Branch

`main`

## 4. HEAD

`64e64ae4289a3b5f556c9b127d5cdc5c71460930` — feat: make the homepage BIT's terminal

Phase 7 and 7.1 are already on this commit. The prompt expected them to still be uncommitted. The approved layout is the one on HEAD, plus the uncommitted X link below.

## 5. Initial working-tree status

Before this pass, `main` matched `origin/main` at `64e64ae` except for the uncommitted X link:

```text
 M apps/web/app/globals.css
 M apps/web/app/page.tsx
 M scripts/bit-composition.test.ts
```

That link was left in place. It is not part of this choreography.

## 6. Files changed

This pass:

- `apps/web/components/bit/bit-terminal.ts`
- `apps/web/components/bit/bit-commentary.ts`
- `apps/web/components/bit/BitSpeech.tsx`
- `apps/web/components/bit/bit-tape.ts`
- `apps/web/components/bit/BitEventTape.tsx`
- `apps/web/components/bit/BitReactionContext.tsx`
- `apps/web/app/globals.css` (arrival distance, active-row brightness, speech min-height; the X-link rules were already in this file)
- `package.json`
- `scripts/bit-terminal.test.ts`
- `scripts/bit-live-state.test.ts`

Not changed for this pass: `page.tsx`, stage size, spacing scale, commentary pools, reaction durations, token actions, the visual-feed view.

## 7. Canonical event/state mapping

| state | prompt | context label | ledger |
| --- | --- | --- | --- |
| IDLE | waiting. | blank | unchanged |
| NOTICE | noticed. | NOTICE | not a ledger kind |
| BUY | buy observed. | BUY | BUY row |
| SELL | sell observed. | SELL | SELL row |
| BUSY | busy. | blank | no row |
| BURN | burn detected. | BURN | BURN row |
| DEX_PAID | dex paid. | DEX PAID | DEX PAID row |

Unknown states use `waiting.` Durations stay NOTICE 640, BUY 680, SELL 740, BURN 840, DEX_PAID 920. Priority stays BURN, then DEX_PAID, then BUY/SELL, then NOTICE. An in-progress cue is not interrupted.

## 8. Ledger arrival behavior

A new row is still inserted newest-first, capped at 5, with the existing `is-new` fade. Duration stays 220ms. The settle is now `translateY(2px)` instead of `0.2rem`. Under reduced motion the animation rule does not apply, so the row appears immediately. Empty copy is still `no activity.` and is not animated.

## 9. Active-ledger-row behavior

The row whose id matches `feed.cueId` gets `is-active`: the kind and the time go to `rgba(243, 240, 232, 0.96)`. No kind colors, backgrounds, or markers. When the cue ends, `cueId` is null and the class drops. A newer queued row stays unemphasized until its own cue is the one BIT is playing.

## 10. Reaction-context lifecycle

The visible label still comes from `reactionContextLabel(pose.state)`. IDLE and BUSY stay blank. The label is on only while that one-shot pose is active, and it clears when the pose returns to IDLE or BUSY. The hidden polite region now announces NOTICE only, so a tape event is not spoken twice.

## 11. Speech lifecycle

The phrase is still `selectPhrase` from the existing pools, seeded by the cue id. The same cue keeps the same phrase for the whole duration, including if the idle tick number changes. BUSY always uses the seed `busy`, so it does not rotate on feed ticks. The idle interval runs only while `idleCommentaryActive(state)` is true, so a reaction does not advance the idle clock. Returning to IDLE resumes the phrase from the same tick instead of rotating immediately.

## 12. Speech transition timing

The existing fade stays: `bit-commentary-in` at 180ms, opacity only, and only when reduced motion is not requested. No typewriter.

## 13. Prompt mapping

```text
IDLE       waiting.
NOTICE     noticed.
BUY        buy observed.
SELL       sell observed.
BUSY       busy.
BURN       burn detected.
DEX_PAID   dex paid.
other      waiting.
```

## 14. Prompt lifecycle

`BitPrompt` reads `pose.state` and has no timer of its own. It changes when the pose owner changes and returns to `waiting.` when the pose is IDLE. A failed feed settles the controller to IDLE, so the prompt does not claim an event.

## 15. BUSY production-source status

Production BUSY has no live source. `mapFeedRows` always sets `busy: false`. `readBitVisualFeed` does not call `setBusy`. The visual view has no BUSY column. BUSY is rehearsal-only (`?bitRehearse=busy`, `busy-burn`). Presentation still supports it.

## 16. NOTICE production-source status

The visual view selects BUY, SELL, TOKEN_BURN, and DEX_PAID. It does not emit NOTICE. NOTICE is rehearsal-only (`?bitRehearse=notice`). No NOTICE rows were fabricated. The ledger correctly stays on `no activity.` during a NOTICE rehearsal because NOTICE is not a tape kind.

## 17. Event deduplication behavior

The controller still remembers cue ids and ignores a second push of the same id. `tapeRows` still drops duplicate ids. Speech is a pure function of state plus that cue id, so one cue does not select a second phrase.

## 18. Rapid-event/queue behavior

Queued together, BURN plays before BUY, and DEX_PAID plays before BUY. Equal-priority BUY → SELL → BUY keeps push order. A BURN pushed after a BUY has already started waits until that BUY finishes, then plays. Nothing in that path was given a second state machine.

`?bitRehearse=buy-sell-buy` showed one stable phrase per cue (`someone's feeling brave`, then `a sell just landed`, then `observed`) and moved the bright row with the playing cue, including while later rows were already listed.

## 19. Idle-settling behavior

Single rehearsals for buy, sell, burn, dex-paid, notice, and busy each returned to the idle phrase `timeline is suspiciously calm`, a blank context label, an unemphasized ledger row, and `> waiting._`. `busy-burn` returned to the same BUSY phrase, `doing computer things`, with the burn row no longer bright.

## 20. Empty-feed behavior

The idle homepage still shows `no activity.` There is no heartbeat row and no looping empty-state animation.

## 21. Feed-failure behavior

`controller.fail()` clears the active cue and the queue and samples IDLE. The prompt is then `waiting.` The ledger copy `Live feed unavailable.` is unchanged. Runtime, market, and mint facts still come from `readPublicRuntime`, not from the feed.

## 22. Layout-stability result

Desktop speech stayed 28px through phrase changes in this review. Mobile speech uses a `2.9em` minimum (measured 52px) so a wrap does not change the stack height. The reaction slot stayed 1rem and did not overlap speech. No horizontal overflow at 1440, 1024, or 390. Facts and the prompt did not move except with the ledger row itself.

## 23. Desktop rehearsal result

1440×900, development server. Headless Chrome did not create a canvas, so the mascot pose itself was not seen.

| rehearsal | during | after |
| --- | --- | --- |
| buy | BUY / there it is / buy observed. / bright BUY row | blank / idle phrase / waiting. / row normal |
| sell | SELL / a sell just landed / sell observed. | settled |
| burn | BURN / reduced / burn detected. | settled |
| dex-paid | DEX PAID / nice / dex paid. | settled |
| notice | NOTICE / interesting / noticed. / ledger stayed `no activity.` | settled |
| busy | blank label / doing computer things / busy. / no row | settled to idle |
| buy-sell-buy | phrase and bright row followed each cue | third BUY was still active when the watch ended |
| busy-burn | busy, then BURN / reduced, then the same busy phrase | burn row no longer bright |

1024×800 `buy-sell-buy` matched the desktop sequence. No overflow.

## 24. Mobile rehearsal result

390×844 `?bitRehearse=buy`. No overflow. Speech height stayed 52px from the idle phrase through `there it is` and back. Prompt stayed `> buy observed._` during the cue and `> waiting._` after. The BUY row was bright only during the cue. The context label did not overlap speech.

## 25. Accessibility/live-region result

Speech is still the `h1` and is not a live region. The prompt cursor stays `aria-hidden`. Facts stay `dt` / `dd`. Two polite regions remain: the ledger announces a new tape kind once, and the context region announces NOTICE only. A BUY no longer produces a second identical announcement. Reduced motion still skips the row settle and the speech fade.

## 26. Performance impact

No new request, route, or poll. Homepage JS grew from 4.58 kB to 4.7 kB. First-load JS stayed 113 kB. That build also includes the uncommitted X link.

## 27. Typecheck result

Pass.

## 28. Lint result

Pass.

## 29. Test result

108 pass, 0 fail. Six of those are new live-state tests.

## 30. Build result

`npm run build -w @heybit/web` passed. No `metadataBase` warning.

Routes: `/`, `/_not-found`, `/api/bit-visual`, `/lab/bit`.

## 31. Build-size result

| route | size | first load |
| --- | --- | --- |
| `/` | 4.7 kB | 113 kB |
| `/lab/bit` | 1.3 kB | 109 kB |
| `/api/bit-visual` | 122 B | 103 kB |

Shared first-load JS 103 kB.

## 32. Remaining functional concerns

This is not a functional approval. Headless review never drew the WebGL mascot, so coordination was checked through labels, speech, the ledger, and the prompt. The `buy-sell-buy` watch ended while the third BUY was still on screen; the return to idle was seen on the single-event rehearsals and covered by the controller tests. The bright row follows the playing cue, so a later queued line can sit above an older emphasized line until that cue starts. Production still has no BUSY or NOTICE source.

## 33. Explicit confirmation

No deployment. No push. No commit. No Vercel, Render, or Supabase changes. No environment writes. No `bit_runtime` writes. No Solana writes. No token activation. No OpenAI calls. No wallet, trading UI, new route, new poll, fabricated events, or layout redesign.
