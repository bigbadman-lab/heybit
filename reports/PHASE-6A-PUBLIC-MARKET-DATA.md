# Phase 6A — Public market/runtime data

## 1. Verdict

AWAITING FUNCTIONAL APPROVAL

## 2. UTC timestamp

2026-10-01T09:27:08Z

## 3. Branch

`main`

## 4. HEAD

`43ddfda` — feat: set the public BIT preview image and favicon

The approved Phase 5 commit `7038efc` is in the history of this HEAD.

## 5. Working-tree status

Dirty with this phase only. Not committed. Not pushed.

```text
 M apps/web/components/bit/BitStatus.tsx
 M package.json
?? apps/web/components/bit/bit-market.ts
?? reports/PHASE-6A-PUBLIC-MARKET-DATA.md
?? scripts/bit-market.test.ts
```

## 6. Files changed

- `apps/web/components/bit/bit-market.ts` — derives MARKET from the canonical launch state
- `apps/web/components/bit/BitStatus.tsx` — adds the MARKET row to the existing status panel
- `scripts/bit-market.test.ts` — source, prelaunch, and forbidden-surface checks
- `package.json` — registers the new test once
- `reports/PHASE-6A-PUBLIC-MARKET-DATA.md` — this report

## 7. Existing data-source audit

Public read-only sources already in the repo:

- `public.bit_runtime` singleton `id = 1`. Anon may select. Columns read today: `canonical_mint`, `launch_state`, `activation_timestamp`, `launch_signature`, `launch_slot`. Launch state is only `PRELAUNCH` or `LIVE`, and `LIVE` requires a mint. The homepage reads it through `readPublicRuntime()` → `getBitRuntime()`.
- `public.bit_visual_feed`. Select-only `cue_id`, `kind`, `observed_at`. Kinds are `BUY`, `SELL`, `BURN`, `DEX_PAID`. No amounts.
- Homepage facts already shown: RUNTIME, MINT, STATE, FEED.

Sources that exist but are not public market data:

- `public.processed_transactions` stores signature, slot, mint, status, BUY/SELL, SOL amount, and token amount. Anon and authenticated have no access. The visual-feed view deliberately omits amounts.
- `public.bit_reactions` stores generated reaction text. It is not a public market table.
- Alchemy is a worker RPC for confirmed transactions. It is not a browser client and it is not a price, liquidity, or holder API.
- OpenAI writes personality text. It is not a market source.

No existing token-metadata route, explorer URL, Pump.fun client, DexScreener client, Jupiter client, holder index, supply figure, or price calculation was found. The env manifest has no market provider.

## 8. Fields available now

```text
RUNTIME     bit_runtime.launch_state
MINT        bit_runtime.canonical_mint
STATE       existing mascot pose
FEED        existing visual-feed poll status
MARKET      derived from launch_state (see 14)
```

## 9. Fields safely derivable

```text
MARKET
```

`PRELAUNCH` → `NOT LIVE`. `LIVE` → `LIVE`. A failed runtime read → `UNAVAILABLE`. A mint without `LIVE` does not make the market live.

## 10. Fields deferred

```text
PRICE
FDV
MARKET CAP
LIQUIDITY
24H VOLUME
HOLDERS
TRADES
```

None of these have a public, current, read-only source. `processed_transactions` could be summed into a private lifetime SOL total, but that table is not public, it is not a 24-hour window, and exposing it would be a new read model. Holder count would need a new chain index. Price, FDV, and liquidity would need a new third-party market fetch. Those were deferred rather than invented.

## 11. Final fields shown in UI

```text
RUNTIME    PRELAUNCH | LIVE | UNAVAILABLE
MINT       NOT LAUNCHED | <canonical mint> | UNAVAILABLE
MARKET     NOT LIVE | LIVE | UNAVAILABLE
STATE      existing mascot state
FEED       … | LIVE | UNAVAILABLE
```

Price, FDV, liquidity, volume, holders, and trades are omitted. No em dash and no zero is shown for them.

## 12. Source for each displayed field

| Field | Source |
| --- | --- |
| RUNTIME | `bit_runtime.launch_state` via `readPublicRuntime()` |
| MINT | `bit_runtime.canonical_mint` via the same read |
| MARKET | `marketStatus(launchState, runtimeKnown)` on that same snapshot |
| STATE | existing `useBitFeed().pose.state` |
| FEED | existing visual-feed status |

## 13. Official-mint source

The official mint remains `bit_runtime.canonical_mint`, read once on the server and passed into `BitStatus`. It is not copied into a component, an env var, or a second config.

## 14. Market-status derivation

`marketStatus` in `apps/web/components/bit/bit-market.ts`:

- runtime unknown → `UNAVAILABLE`
- `launch_state === "LIVE"` → `LIVE`
- `launch_state === "PRELAUNCH"` → `NOT LIVE`
- any other value → `UNAVAILABLE`

`LIVE` is not inferred from mint presence. `PAUSED` is not a runtime state and is not shown.

## 15. Price semantics

Not included. No spot, quote, or latest-price source exists.

## 16. FDV / market-cap semantics

Not included. Circulating supply and total supply are both unknown, so neither FDV nor market cap is shown.

## 17. Liquidity semantics

Not included. No pool or venue liquidity source exists.

## 18. Volume semantics

Not included. The private ledger has per-trade SOL amounts, but they are not a public rolling 24-hour volume. Lifetime volume was not relabeled and was not shown.

## 19. Holder semantics

Not included. No holder-count source exists. Transaction participants are not counted as holders.

## 20. Trade-count semantics

Not included. The visual feed is a short cue list, not a lifetime or 24-hour trade count.

## 21. Polling architecture

No new poll was added. RUNTIME, MINT, and MARKET come from the existing server render of `bit_runtime` (`force-dynamic`, one read per request). The visual feed stays on its existing `GET /api/bit-visual` poll. Market fields do not refresh at tape speed.

## 22. Staleness handling

There is no cached quote to go stale. MARKET is the current runtime row. If that read fails, the row is `UNAVAILABLE` instead of a leftover value. `bit_runtime.updated_at` exists in the table and is not part of the public column list, so it is not displayed.

## 23. Prelaunch behavior

Current homepage, with the live runtime still `PRELAUNCH` and no mint:

```text
RUNTIME    PRELAUNCH
MINT       NOT LAUNCHED
MARKET     NOT LIVE
STATE      IDLE
FEED       LIVE
```

No token-market endpoint is called. No zero market rows are rendered. When `launch_state` becomes `LIVE` with the canonical mint, MARKET becomes `LIVE` without a new env flag. The deferred metrics stay omitted until a real source exists.

## 24. Failure behavior

`readPublicRuntime()` already returns null on failure. That renders RUNTIME `UNAVAILABLE`, MINT `UNAVAILABLE`, and MARKET `UNAVAILABLE`. The page, mascot, tape, and commentary still render. No raw error is shown.

## 25. Confirmation no manual launch toggle was added

No `MARKET_ENABLED`, `TOKEN_LIVE`, `SHOW_MARKET_DATA`, or other launch switch was added to code or `config/env-manifest.json`.

## 26. Confirmation no wallet or trading UI was added

No wallet library, connect button, signing, swap, amount input, slippage, quote, or chart was added.

## 27. Desktop result

1440×900. No horizontal overflow (`scrollWidth` 1440). Column and stage 352×352, stage top 23. Reaction slot 16px. Tape 352×31. Status 352×115 ending at y 630. Commentary ends at y 666, inside the first screen. Rows: RUNTIME PRELAUNCH, MINT NOT LAUNCHED, MARKET NOT LIVE, STATE IDLE, FEED LIVE.

## 28. Tablet result

1024×800. No horizontal overflow. Column and stage 320×320. Status ends at y 596. Commentary ends at y 632, inside the viewport. Same five rows.

## 29. Mobile result

390×844. No horizontal overflow. Column and stage 256×256. Status ends at y 510. Commentary ends at y 546, inside the viewport. Labels and values stay on one row with the existing space-between layout. Same five rows.

## 30. Accessibility result

MARKET uses the existing `dt` / `dd` pair inside the status description list. The status panel has no `aria-live`. The two existing polite live regions (reaction context and tape) were not given market ticks. Contrast is the existing near-monochrome status type. No assertive price announcements.

## 31. Typecheck result

Pass. `npm run typecheck` exited 0.

## 32. Lint result

Pass. `npm run lint` exited 0.

## 33. Test result

Pass. `npm test` — 96 passed, 0 failed. The two new market tests are included.

## 34. Build result

Pass. `npm run build` exited 0. `/` is 3.86 kB, first load 112 kB. `/lab/bit` is 1.3 kB, first load 109 kB. The existing `metadataBase` warning during static generation was left as-is.

## 35. Manual review instructions

The local app is on `http://localhost:3000`.

On `/`, confirm the panel reads RUNTIME PRELAUNCH, MINT NOT LAUNCHED, MARKET NOT LIVE, STATE IDLE, FEED LIVE, with commentary under it and the tape above it. Confirm BIT is still the largest element and that no price, holder, volume, wallet, or swap control appears.

On `/lab/bit`, confirm the lab is still the manual mascot view and has no status panel.

## 36. Remaining functional concerns

Price, FDV, liquidity, 24-hour volume, holders, and trade counts cannot be shown truthfully until a public source exists. Headless Chrome does not create the WebGL canvas, so this review measured DOM layout; the mascot fallback remains the transparent mark until a normal display draws the stage. After launch, MARKET will follow `bit_runtime` to LIVE, and the deferred metrics will stay hidden until they can be sourced.

## 37. Explicit confirmation

No deployment, no push, no commit, no Vercel change, no Render change, no environment change, no Supabase write, no migration, no Solana write, no token activation, and no OpenAI or other AI call occurred.
