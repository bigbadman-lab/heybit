# Phase 7 reset — BIT as a living onchain entity

## 1. Verdict

AWAITING VISUAL APPROVAL

## 2. UTC timestamp

2026-10-01T11:37:21Z

## 3. Branch

`main`

## 4. HEAD

`c745691123b6f95b45df34135cf214bbafbdf053` — fix: finalize public token metadata

## 5. Initial working-tree status

Before cleanup, `main` was at `c745691` and the only dirty work was uncommitted Phase 7A:

```text
 M apps/web/app/globals.css
 M apps/web/app/page.tsx
 M apps/web/components/bit/bit-tape.ts
 M package.json
 M scripts/bit-market.test.ts
 M scripts/bit-token-actions.test.ts
?? apps/web/components/bit/HomeLower.tsx
?? apps/web/components/bit/home-lower.ts
?? reports/PHASE-7A-HOMEPAGE-EXPANSION.md
?? scripts/bit-home-lower.test.ts
```

The tracked diffs were the lower-page sections only. No unrelated work was present.

## 6. Exact Phase 7A cleanup performed

Tracked files were restored to HEAD:

```text
apps/web/app/globals.css
apps/web/app/page.tsx
apps/web/components/bit/bit-tape.ts
package.json
scripts/bit-market.test.ts
scripts/bit-token-actions.test.ts
```

Untracked Phase 7A files were removed:

```text
apps/web/components/bit/HomeLower.tsx
apps/web/components/bit/home-lower.ts
scripts/bit-home-lower.test.ts
reports/PHASE-7A-HOMEPAGE-EXPANSION.md
```

## 7. Clean checkpoint confirmation before rebuild

`git status` after that cleanup reported a clean tree on `c745691`. The terminal rebuild started from that checkpoint. Phase 6B and 6B.1 code was not reverted.

## 8. Files changed for reset

```text
 M apps/web/app/globals.css
 M apps/web/app/page.tsx
 M apps/web/components/bit/BitEventTape.tsx
 M apps/web/components/bit/BitStatus.tsx
 M apps/web/components/bit/bit-tape.ts
 M package.json
 M scripts/bit-commentary.test.ts
 M scripts/bit-composition.test.ts
 M scripts/bit-market.test.ts
 M scripts/bit-reaction-context.test.ts
 M scripts/bit-tape.test.ts
?? apps/web/components/bit/BitPrompt.tsx
?? apps/web/components/bit/BitSpeech.tsx
?? apps/web/components/bit/bit-terminal.ts
?? reports/PHASE-7-RESET-LIVING-BIT.md
?? scripts/bit-terminal.test.ts
```

## 9. Final homepage architecture

One column inside `main.home`, in this order:

```text
HEYBIT
BIT
reaction context
speech
activity ledger
runtime / market / mint / feed
token actions, only when live
> waiting.
```

There is no wide container, no card stack, and no second page of marketing sections.

## 10. BIT preservation confirmation

Mascot geometry, camera, halo, stage transparency, fallback, and reaction files were not edited. `--bit-column` is still 22rem / 20rem / 16rem. Measured stage: 352×352 at 1440, 320×320 at 1024, 256×256 at 390.

## 11. Speech / commentary presentation

The visible heading is the existing commentary phrase, rendered by `BitSpeech` through `selectPhrase`. Pools were not rewritten. On the current idle page the line was `timeline is suspiciously calm`. The old visible `BIT is waking up.` heading is gone. That sentence remains the page description in metadata. The phrase still fades when it changes, and it is not an assertive live region.

## 12. Activity-ledger implementation

`BitEventTape` still reads `tapeRows(feed.events)` from the shared feed. Newest five supported events, same kinds. A real `atMs` is shown as a local clock; if the timestamp is missing, the existing relative age is used and no clock is invented. The empty feed shows `no activity.` An unavailable feed still shows `Live feed unavailable.` There is no marquee and no second list.

## 13. System-facts implementation

`BitStatus` now shows only:

```text
RUNTIME    PRELAUNCH | LIVE | UNAVAILABLE
MARKET     NOT LIVE | LIVE | UNAVAILABLE
MINT       NOT LAUNCHED | <mint> | UNAVAILABLE
FEED       … | LIVE | UNAVAILABLE
```

`MARKET` still comes from `marketStatus`. A mint alone does not make it live. The mascot `STATE` row was removed so the pose is not repeated under the speech. `NETWORK` was left out to keep the block to those four facts. No price, FDV, liquidity, holders, or volume.

## 14. Terminal-prompt implementation

`terminalPrompt` returns `waiting.` while the pose is `IDLE`, and `observing.` for every other known state. The page renders `> waiting.` with a decorative `_`. The cursor is `aria-hidden` and blinks only when reduced motion is not requested. It is not an input and it does not call a model.

## 15. Token-action behavior

`BitTokenActions` is unchanged. It still appears only for `LIVE` plus a valid canonical mint, as SOLSCAN and COPY MINT. The prelaunch page showed neither. No Pump.fun or market link was added.

## 16. Data-source reuse

One `readPublicRuntime()` call. One `BitVisualFeed` provider. Speech, reaction context, the ledger, the feed fact, and the prompt all read that provider. Market status and mint labels are the existing helpers.

## 17. Confirmation no new polling or infrastructure

`GET /api/bit-visual` is still fetched in one place. No new route, table, view, worker, cron, websocket, RPC, or AI call.

## 18. PRELAUNCH result

Measured on `/`:

```text
HEYBIT
timeline is suspiciously calm
no activity.
RUNTIME    PRELAUNCH
MARKET     NOT LIVE
MINT       NOT LAUNCHED
FEED       LIVE
> waiting.
```

No token actions. No landing-page headings.

## 19. LIVE behavior

Covered by the existing token-action tests and `marketStatus`. A live runtime with a valid mint shows SOLSCAN and COPY MINT and sets RUNTIME and MARKET to `LIVE`. Production runtime was not modified, so the browser stayed on the real prelaunch row.

## 20. Desktop result

1440×900. No horizontal overflow. Stage 352×352, starting at y 133. Page height 1035px, about 115vh. Column stays the approved 22rem. No wide grid.

## 21. Tablet result

1024×800. No horizontal overflow. Stage 320×320. Page height 928px, about 116vh. Same stack and the same four facts.

## 22. Mobile result

390×844. No horizontal overflow (`scrollWidth` 390). Stage 256×256. Page height 888px. Speech is 1.25rem and left-aligned in the 16rem column. Facts stay on one row each.

## 23. Accessibility result

The speech line is the only `h1`. The ledger is a list with an accessible name of Activity, and its polite live region still announces a new kind without being assertive. Facts remain `dt` / `dd`. The cursor is hidden from assistive tech. Token-action focus outlines are unchanged. Reduced motion stops the cursor blink and keeps the existing commentary fade rule.

## 24. Performance impact

No second WebGL scene, no animation library, and no new image. The only new motion is the cursor blink.

## 25. Typecheck result

Pass. `npm run typecheck` exited 0.

## 26. Lint result

Pass. `npm run lint` exited 0.

## 27. Test result

Pass. `npm test` — 102 passed, 0 failed.

## 28. Build result

Pass. `npm run build` exited 0. Routes are unchanged: `/`, `/_not-found`, `/api/bit-visual`, `/lab/bit`. No metadata warning was printed. `/lab/bit` is still 1.3 kB, first load 109 kB.

## 29. Build-size result

Approved homepage before this reset: `/` 4.32 kB, first load 112 kB.

This build: `/` 4.58 kB, first load 113 kB.

The rejected Phase 7A page was 5.62 kB and 114 kB. That expansion is not in this build. Shared first-load JS remains 103 kB.

## 30. Remaining visual concerns

Headless Chrome did not draw the WebGL mascot, so the character still needs a normal display. The stage box matches the locked sizes. The live ledger has not been seen with real rows, because the feed is empty. The page is about 115vh on a 900px desktop, sparse rather than a long scroll. Whether that feels like visiting BIT is a visual judgment.

## 31. Explicit confirmation

No deployment, no push, no commit, no Vercel change, no Render change, no Supabase write, no runtime write, no Solana write, no token activation, and no OpenAI or other AI call occurred.
