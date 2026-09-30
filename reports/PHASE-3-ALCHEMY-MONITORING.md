# Phase 3 — Alchemy monitoring

## 1. Verdict

`BLOCKED`

The read-only monitoring foundation is implemented and Alchemy mainnet connectivity passed. The listener is idle because runtime state is `PRELAUNCH`. The new `processed_transactions` migration has not been applied, so durable dedupe is not verifiable in Supabase.

## 2. UTC timestamp

`2026-09-30T16:49:26Z`

## 3. Branch

`main`

## 4. HEAD

None. The branch has no commits yet.

## 5. Initial Phase 3 state

Phase 2 code was present. `bit_runtime` is readable and `PRELAUNCH` with a null mint. `supabase/config.toml` was absent, so the repo is not linked to a Supabase project.

## 6. Files changed

- `supabase/migrations/20260930163700_create_processed_transactions.sql`
- `packages/shared/src/trade.ts`
- `packages/shared/src/trade.test.ts`
- `packages/shared/src/fixtures.ts`
- `packages/shared/package.json`
- `apps/worker/src/alchemy.ts`
- `apps/worker/src/listener.ts`
- `apps/worker/src/ledger.ts`
- `apps/worker/src/decode-transaction.ts`
- `apps/worker/src/monitor.ts`
- `apps/worker/src/runtime.ts`
- `apps/worker/src/health.ts`
- `apps/worker/src/health.test.ts`
- `apps/worker/src/index.ts`
- `apps/worker/package.json`
- `scripts/alchemy-check.ts`
- `scripts/trade-inspect.ts`
- `scripts/launch-status.ts`
- `scripts/launch-preflight.ts`
- `scripts/lib/launch-report.ts`
- `scripts/lib/preflight.ts`
- `scripts/launch-report.test.ts`
- `package.json`
- `package-lock.json`
- `docs/ARCHITECTURE.md`
- `docs/LAUNCH_MODEL.md`
- `docs/FINAL_PRELAUNCH_CHECKLIST.md`

## 7. Alchemy client architecture

`apps/worker/src/alchemy.ts` uses `@solana/web3.js` `Connection` for confirmed HTTP reads only. Websocket probes and the mint listener use a direct websocket. Endpoints come from `ALCHEMY_SOLANA_RPC_URL` and `ALCHEMY_SOLANA_WSS_URL`. Failures are reported as PASS/FAIL labels. URLs are not printed.

## 8. Network verification method

`getGenesisHash` is compared with the public mainnet-beta genesis hash `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`. Devnet, testnet, and unknown hashes are rejected. This does not depend on the URL name.

## 9. Runtime-driven listener behaviour

The worker polls `bit_runtime` every 5 seconds. `PRELAUNCH` or a null mint keeps the listener idle. `LIVE` plus a canonical mint starts logs for that mint. No environment boolean controls this. A runtime read failure degrades health and retries. It does not crash the process, and it does not update `bit_runtime`.

## 10. Subscription strategy

`logsSubscribe` with `mentions: [canonical mint]` and commitment `confirmed`. The websocket payload is only a signature trigger. The worker then calls `getTransaction` and classifies that confirmed transaction.

## 11. Confirmation model

Commitment is `confirmed`. Transactions with `meta.err` are ignored and stored as `failed`. They do not become BUY or SELL events.

## 12. Durable transaction schema

`public.processed_transactions`.

- `signature` primary key
- `slot`
- `canonical_mint`
- `status` of `trade`, `ignored`, or `failed`
- `event_type` of `BUY` or `SELL` only for trades
- `sol_amount`
- `token_amount`
- `observed_at`, `processed_at`, `created_at`

RLS is enabled. `anon` and `authenticated` have no privileges. The browser does not read this table.

## 13. Event storage model

One ledger table stores both the processed signature and the normalized trade fields. A second `bit_events` table was not added, so a duplicate cannot leave a trade row and a ledger row out of sync. There are no OpenAI or personality-text columns.

## 14. Deduplication model

The signature primary key is the durable identity. Inserts use `ignoreDuplicates`. A second claim returns `duplicate` and does not add another row. An in-memory set is not the source of truth. Unit tests cover a restart against the same ledger.

## 15. BUY/SELL parser approach

Direction is taken from the fee payer, the wallet that signed and paid the fee. That is the trader on a Pump buy or sell, not the bonding-curve token account.

- Fee-payer token balance for the mint increases and their SOL decreases, after adding the network fee back: `BUY`
- Fee-payer token balance decreases and their SOL increases: `SELL`
- Anything else is ignored

The model does not decide the direction.

## 16. Fixture coverage

Sanitized fixtures cover BUY, SELL, failed, irrelevant, malformed, and duplicate signatures. Amounts are deterministic: 0.5 SOL and 1 token in the BUY and SELL fixtures.

## 17. Reconnect / restart behaviour

Socket close moves an active listener to `RECONNECTING` and retries with backoff from 1 second to 30 seconds. A successful subscribe resets the backoff. A Supabase blip does not by itself drop an active listener. Restart safety comes from the signature primary key.

## 18. Worker health changes

Health now includes `alchemyRpc`, `alchemyWss`, and `tradeListener`. Expected prelaunch idleness is `healthy` when Supabase and Alchemy are ready. Alchemy or Supabase loss is `degraded`, not a crash.

## 19. `launch:status` result

```text
Canonical mint ....... none
Launch state ......... PRELAUNCH
Database ............. CONNECTED
Runtime row .......... PASS
Alchemy RPC .......... PASS
Alchemy WSS .......... PASS
Trade listener ....... IDLE
Reason ............... token not live
VERDICT: PRELAUNCH
```

## 20. `launch:preflight` result

Alchemy, the runtime row, and the trade parser passed. Durable dedupe failed. Verdict: `PHASE 3 BLOCKED`. OpenAI, the final website, and the production worker are not claimed complete. The output does not approve a launch.

## 21. Alchemy check result

```text
RPC .................. PASS
Network .............. MAINNET
Current slot ......... 452023094
WSS .................. PASS
VERDICT: PASS
```

No RPC or websocket URL was printed. No transaction was sent.

## 22. Typecheck result

PASS. Exit code 0.

## 23. Lint result

PASS. Exit code 0.

## 24. Test result

PASS. 41 tests, 0 failures.

## 25. Build result

PASS. Web, worker, and shared builds completed.

## 26. Migration application status

Not applied. `supabase/config.toml` is absent, so the migration was not pushed. `bit_runtime` is already present. `processed_transactions` is not.

## 27. Blockers

Apply `supabase/migrations/20260930163700_create_processed_transactions.sql` to the same Supabase project, then run `npm run launch:preflight`.

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push
npm run launch:preflight
```

The SQL file can be run in that project's SQL editor instead of `supabase db push`.

## 28. Explicit confirmations

- no deployment
- no Vercel changes
- no Render production changes
- no token activation
- no Solana writes
- no token creation
- no Pump launch
- no OpenAI calls
- no AI reactions
- no burn execution
- no DEX-paid mutation
- no secrets printed
