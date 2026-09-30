# Phase 4 — Reaction aggregation and OpenAI personality

## 1. Verdict

`BLOCKED`

Aggregation, bounded OpenAI concurrency, stale-summary expiry, fallback behavior, and the live model check are in place. `bit_reactions` is not in the database yet, so durable reaction idempotency is not verifiable. This is not launch approval.

## 2. UTC timestamp

`2026-09-30T17:36:23Z`

## 3. Branch

`main`

## 4. HEAD

`0f8d729` (`feat: complete heybit phases 1 through 3.1`). Phase 4 changes are uncommitted.

## 5. Initial Phase 4 state

Phases 1 through 3.1 were committed. Runtime was `PRELAUNCH` with a null mint. Trade ingestion was bounded at 8. There was no reaction table, scheduler, or OpenAI call path. The repo has no `supabase/config.toml`.

## 6. Files changed

- `packages/shared/src/reaction.ts`
- `packages/shared/src/reaction.test.ts`
- `packages/shared/src/reaction-stress.ts`
- `packages/shared/package.json`
- `apps/worker/src/openai-reactions.ts`
- `apps/worker/src/reaction-store.ts`
- `apps/worker/src/reactions.ts`
- `apps/worker/src/monitor.ts`
- `apps/worker/src/runtime.ts`
- `apps/worker/src/health.ts`
- `apps/worker/src/health.test.ts`
- `apps/worker/package.json`
- `supabase/migrations/20260930181600_create_bit_reactions.sql`
- `scripts/openai-check.ts`
- `scripts/reactions-stress.ts`
- `scripts/launch-status.ts`
- `scripts/launch-preflight.ts`
- `scripts/launch-report.test.ts`
- `scripts/lib/launch-report.ts`
- `scripts/lib/preflight.ts`
- `package.json`
- `package-lock.json`
- `docs/ARCHITECTURE.md`
- `docs/LAUNCH_MODEL.md`
- `docs/FINAL_PRELAUNCH_CHECKLIST.md`
- `reports/PHASE-4-REACTION-PIPELINE.md`

## 7. Reaction architecture

Confirmed trades stay in `processed_transactions`. A separate scheduler turns closed 8-second windows into one activity summary. OpenAI receives that summary, not the raw transaction. A validated line is stored in `bit_reactions`. During `PRELAUNCH` the scheduler is idle and does not call OpenAI. Every trade can be recorded. Not every trade gets a reaction.

## 8. Aggregation window

`REACTION_WINDOW_MS = 8000`. Windows are aligned to epoch time. The constant is in code, not an environment variable.

## 9. Activity-level thresholds

- `LOW`: 1–2 trades, mode `INDIVIDUAL`
- `MEDIUM`: 3–9 trades, mode `BURST`
- `HIGH`: 10–29 trades, mode `BURST`
- `VERY_HIGH`: 30 or more trades, mode `BURST`

## 10. Net-direction rule

Compare confirmed SOL totals only. `BUY_HEAVY` when buy SOL is more than 1.2 times sell SOL. `SELL_HEAVY` when sell SOL is more than 1.2 times buy SOL. Otherwise `BALANCED`. This is recent flow, not a price prediction.

## 11. Reaction cooldown

Ordinary lines wait at least 5 seconds. `HIGH` waits 15 seconds. `VERY_HIGH` waits 30 seconds, so heavier activity produces fewer lines. Events during a cooldown stay in the latest summary. They do not become one queued reaction each.

## 12. Normal reaction TTL

30 seconds. A normal summary older than that is marked `EXPIRED` and is not generated later. Priority events do not use this TTL.

## 13. OpenAI concurrency limit

`MAX_OPENAI_REACTION_CONCURRENCY = 1`. The scheduler holds a single in-flight generation. Reaction source does not use `Promise.all`.

## 14. Reaction queue behavior

The queue holds activity summaries, not raw trades. Only the newest unsent normal summary is kept. A newer window replaces the older one. Priority events sit ahead of normal summaries. The priority list stops accepting new items at 32 and does not drop the ones already queued.

## 15. Stale backlog strategy

If OpenAI is down, later windows supersede older unsent summaries. After the TTL, the leftover summary expires. Recovery generates only a fresh summary. The stress run jumped the clock 120 seconds and made no additional OpenAI calls for the old backlog.

## 16. Priority-event framework

`TOKEN_BURN` and `DEX_PAID` are priority reaction inputs. They are ordered ahead of normal summaries and are not expired by the normal TTL. This phase does not execute burns or record a real DEX-paid event. The stress priority id is synthetic and stays in memory.

## 17. Reaction schema

`public.bit_reactions` stores `source_key`, reaction type, source mode, window bounds, event count, activity level, text, model, and status (`PENDING`, `GENERATED`, `FAILED`, `EXPIRED`). Generated text is limited to 120 characters. Row level security is on. `anon` and `authenticated` have no grants. The table does not store prompts or credentials. The migration does not change `bit_runtime` or `processed_transactions`.

## 18. Reaction idempotency model

`source_key` is unique. A window key is `window:<start>`. A priority key is `priority:<type>:<id>`. The store claims with an insert that ignores duplicates, then finishes the owned row. A second scheduler using the same store does not create a second generated line. The live table is not applied yet, so preflight reports this check as `FAIL`.

## 19. OpenAI model and client

Model `gpt-6-luna`, Responses API, `store: false`, no tools, client timeout 15 seconds, SDK retries disabled. The key is read from `OPENAI_API_KEY` on the server only. Errors are classified without logging the key or the request.

## 20. Personality prompt summary

BIT is calm, brief, and slightly strange. It may describe confirmed past activity in one short line, or two very short lines. It must not tell anyone to buy, sell, or hold, shame a seller, predict price, or give financial advice.

## 21. Output contract

Plain text, at most 120 characters and 2 lines. Markdown fences, heading marks, and wrapping quotes are stripped. Over-long output is rejected. OpenAI is not called again to repair it.

## 22. Content-validator rules

Case-insensitive phrases: `buy now`, `buy more`, `do not sell`, `don't sell`, `dont sell`, `hold` as a whole word, `moon`, `guaranteed`, `going higher`, `price target`, `last chance`, `holders will win`. Rejected text is not stored. A deterministic fallback is stored instead.

## 23. Fallback strategy

`i saw that.` for a low individual trade. `things are moving.` for a medium burst. `a lot happened at once.` for high or very high activity. `noted.` for a priority event. Used when the API times out, rate-limits, returns empty text, or fails validation.

## 24. Retry policy

At most 2 attempts for a transient API failure. Empty, invalid, and prohibited output are not retried. One source key still produces one stored result.

## 25. Circuit-breaker behavior

Three failed opportunities open a 60-second degraded window. During that window the scheduler does not call OpenAI. It may store one fallback, then it stays quiet. When the window ends, the next fresh summary may call the API again. Trade ingestion is unchanged. Worker health stays healthy if inference is degraded.

## 26. Reaction stress design

`npm run reactions:stress` sends 1,000 synthetic trades through 20 windows of 50, with mocked inference. It covers a priority jump, an outage, expiry, recovery, and a restart against the same memory store. It does not call OpenAI and does not write to Supabase.

## 27. Stress event count

`1000`

## 28. Aggregation window count

`22` (the scripted windows plus the priority setup trade and the fresh recovery trade)

## 29. OpenAI attempt count

`10`

## 30. Successful reaction count

`7`

## 31. Expired or superseded summary count

`15`

## 32. Maximum observed OpenAI concurrency

`1`

## 33. OpenAI outage and recovery result

`PASS`. After the outage, advancing past the TTL did not add attempts. Recovery made `1` attempt. Restart did not duplicate the stored reaction.

## 34. Priority-ordering result

`PASS`. The synthetic `TOKEN_BURN` was generated before the queued activity summary.

## 35. Typecheck result

`PASS`

## 36. Lint result

`PASS`

## 37. Test result

`PASS`. 65 tests.

## 38. Build result

`PASS`

## 39. `openai:check` result

`PASS`. API, model, output contract, and content validator passed. Sample reaction: `A small buy: 0.01 SOL.`

## 40. `launch:status` result

`PRELAUNCH`. Canonical mint `none`. Trade listener `IDLE`. OpenAI `PASS`. Reaction pipeline `READY`. Reaction scheduler `IDLE`. Reason `token not live`. Exit 0. The status text says this is not launch approval.

## 41. `launch:preflight` result

`VERDICT: PHASE 4 BLOCKED`. OpenAI, aggregation, and reaction stress passed. Reaction idempotency failed because `bit_reactions` is not readable. Final website `NOT IMPLEMENTED`. Production worker `NOT DEPLOYED`. Production readiness `NOT PRODUCTION READY`.

## 42. Migration application status

Not applied. `supabase/config.toml` is absent, so the repo is not linked to a project. The migration file is `supabase/migrations/20260930181600_create_bit_reactions.sql`.

## 43. Any blockers

Apply that migration to the existing Supabase project, in the SQL editor or after an explicit link and `db push`. Do not change `bit_runtime`. Do not set `LIVE`. Then run `npm run launch:preflight` again.

## 44. Explicit confirmations

- no deployment
- no Vercel production changes
- no Render production changes
- no token activation
- no Pump launch
- no Solana writes
- no burn execution
- no DEX-paid mutation
- no secrets printed

`npm run launch:activate`, `npm run bit:burn`, and `npm run bit:dex-paid` still refuse writes. The command test covering those refusals passed. `.env.local` remains gitignored.
