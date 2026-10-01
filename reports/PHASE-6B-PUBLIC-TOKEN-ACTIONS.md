# Phase 6B — Public token actions

## 1. Verdict

PASS

## 2. UTC timestamp

2026-10-01T10:26:50Z

## 3. Branch

`main`

## 4. HEAD

`5c789c9250517764fefba37f39bc7b6ef47d028c`

`origin/main` already contains this commit. The branch was up to date before the audit.

## 5. Commit audited

- Full hash: `5c789c9250517764fefba37f39bc7b6ef47d028c`
- Subject: `feat: add public token links for a live mint`

## 6. Working-tree status before audit

Clean. `git status` reported nothing to commit.

## 7. Files included in `5c789c9`

- `apps/web/app/globals.css`
- `apps/web/components/bit/BitStatus.tsx`
- `apps/web/components/bit/BitTokenActions.tsx`
- `apps/web/components/bit/bit-market.ts`
- `apps/web/components/bit/bit-token-actions.ts`
- `package.json`
- `packages/shared/src/index.ts`
- `reports/PHASE-6A-PUBLIC-MARKET-DATA.md`
- `scripts/bit-market.test.ts`
- `scripts/bit-token-actions.test.ts`

10 files, +556 / −2.

## 8. Phase 6A market-status row

The uncommitted Phase 6A `MARKET` row was included in this same commit because it lives in `BitStatus.tsx` with the token actions. Semantics in `marketStatus`:

- runtime unknown → `UNAVAILABLE`
- `PRELAUNCH` → `NOT LIVE`
- `LIVE` → `LIVE`
- any other value → `UNAVAILABLE`

`LIVE` is taken only from `launch_state`. A mint by itself does not make the market live. No price, FDV, liquidity, volume, holder, or trade row was added.

## 9. Canonical mint source

The homepage still reads `bit_runtime.canonical_mint` once, through `readPublicRuntime()`, and passes `runtime.canonicalMint` into `BitStatus`. `BitTokenActions` receives that same `mint` prop. The mint is not hard-coded in the UI and was not copied into an environment variable.

Outbound URLs are built only after `isCanonicalMint`, the same structural check the runtime parser uses: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`.

## 10. Runtime gating rule

Actions render only when `launch_state === "LIVE"` and the mint passes `isCanonicalMint`. `PRELAUNCH` hides them even if a mint string is present. An invalid mint hides them. A failed runtime read passes a null mint, so the actions stay hidden.

A development-only `?bitActions=` query can preview the controls. `developmentActionMint` returns null when `NODE_ENV` is `production`, and it does not write runtime state.

## 11. Solscan implementation

Pattern:

```text
https://solscan.io/token/${encodeURIComponent(mint)}
```

Solscan's public token page is mainnet unless a cluster query is added. This URL adds none. The anchor uses `target="_blank"` and `rel="noopener noreferrer"`. Opening it does not call a backend route and does not include an RPC credential.

## 12. Copy-mint implementation

The button calls `navigator.clipboard.writeText` with `active.mint`, the same string used in the Solscan path. The status row still shows the full mint or `NOT LAUNCHED`; the copy path does not truncate. Success replaces the label with `COPIED` and clears it after 1600ms. A clipboard rejection returns false and leaves the label at `COPY MINT`. There is no modal and no clipboard library.

## 13. Pump.fun decision

DEFERRED

`bit-token-actions.ts` states that Pump.fun is omitted because the repo has no canonical Pump.fun URL. No route was added during this audit.

## 14. Market-link decision

DEFERRED

No canonical market, DEX, or pool URL exists in the repo. No generic market link was added during this audit.

## 15. Prelaunch behavior

On `/` at 1440, 1024, and 390 the panel read:

```text
RUNTIME    PRELAUNCH
MINT       NOT LAUNCHED
MARKET     NOT LIVE
STATE      IDLE
FEED       LIVE
```

No `.bit-actions` node was present. No Solscan link and no copy button.

## 16. LIVE + mint behavior

`tokenActionLinks("LIVE", validMint)` returns the Solscan URL and the exact mint. `PRELAUNCH` with that same mint returns null. Invalid strings return null.

The production runtime was not modified. The existing development query `?bitActions=` with a 32-character structural mint was used only to render the controls in the browser. The status rows stayed `PRELAUNCH` / `NOT LAUNCHED` / `NOT LIVE`, which is correct: the query does not change `bit_runtime`. The rendered controls were SOLSCAN and COPY MINT only. The Solscan href was `https://solscan.io/token/11111111111111111111111111111111`. Copy wrote that exact 32-character string and the button label became `COPIED`. No Pump.fun link, market link, wallet control, or trading control appeared. `/lab/bit` had no status panel and no actions.

## 17. Confirmation no manual launch toggle exists

No `TOKEN_LINKS_ENABLED`, `SHOW_ACTIONS`, `MARKET_ENABLED`, `TOKEN_LIVE`, or `SHOW_MARKET_DATA` flag was added to the commit or `config/env-manifest.json`.

## 18. Confirmation no wallet connect exists

No wallet adapter, Phantom, Reown, connect button, or balance read was added.

## 19. Confirmation no trading UI exists

No swap, slippage, quote, buy button, sell button, or chart was added.

## 20. Desktop result

1440×900. No horizontal overflow. Stage 352×352. Prelaunch commentary ends at y 666 with no actions. With the development preview, the action row is 352×24 and ends at y 704, still under the mascot. BIT remains the largest element.

## 21. Tablet result

1024×800. No horizontal overflow. Stage 320×320. Prelaunch commentary ends at y 632 with no actions. With the preview, the action row is 320×24 and ends at y 669.

## 22. Mobile result

390×844. No horizontal overflow. Stage 256×256. Prelaunch commentary ends at y 546 with no actions. With the preview, the controls stack and the action block is 256×55, ending at y 615, inside the viewport.

## 23. Accessibility result

The Solscan control is an anchor whose accessible name is `SOLSCAN`. Copy is a `button` with `type="button"`. Its live region is `polite`, not `assertive`. Focus uses the same outline as hover (`:focus-visible` on `.bit-actions a` and `.bit-actions button`), so the controls are not hover-only. The external link sets `rel="noopener noreferrer"`.

## 24. Typecheck result

Pass. `npm run typecheck` exited 0.

## 25. Lint result

Pass. `npm run lint` exited 0.

## 26. Test result

Pass. `npm test` — 100 passed, 0 failed.

## 27. Build result

Pass. `npm run build` exited 0.

`/` is 4.32 kB, first load 112 kB. `/lab/bit` is 1.3 kB, first load 109 kB. Routes are `/`, `/_not-found`, `/api/bit-visual`, and `/lab/bit`. No new route was added.

## 28. Build warnings

The existing warning remains: `metadataBase` is not set, so static generation used `http://localhost:3000` for social images. It was not changed. No new warning was introduced by this commit.

## 29. Manual review instructions

The local app is on `http://localhost:3000`.

On `/`, confirm the five prelaunch rows and the absence of SOLSCAN and COPY MINT.

The development preview `/?bitActions=` followed by a structurally valid mint shows those two controls without writing `bit_runtime`. Production ignores that query. A real `LIVE` runtime row is what makes the controls appear for visitors.

`/lab/bit` should still have no status panel.

## 30. Remaining functional concerns

Pump.fun and a separate market destination stay deferred until the repo has a canonical URL. Headless Chrome does not draw the WebGL mascot, so this review measured DOM layout; the stage box is the locked column size. The copy-label reset is 1600ms in the component; the browser check confirmed the label changed to `COPIED` and that the clipboard received the full mint.

## 31. Confirmation the commit was already pushed

`5c789c9` was on `origin/main` before this audit. `git merge-base --is-ancestor` confirmed origin contains it. This audit did not push.

## 32. Confirmation no history rewrite

No amend, reset, revert, or other history rewrite was performed.

## 33. Explicit confirmation

No deployment, no Supabase write, no runtime write, no Solana write, no token activation, and no OpenAI or other AI call occurred during this audit. The only file added is this report. It is uncommitted.
