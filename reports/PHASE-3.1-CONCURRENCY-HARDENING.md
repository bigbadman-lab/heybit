# Phase 3.1 — Concurrency hardening

## 1. Verdict

`PASS`

Processing concurrency is capped at 8. A synthetic burst of 1,000 signatures stayed inside that cap, collapsed duplicates, retried transient failures, and drained to an empty queue. `npm run launch:preflight` reports `PHASE 3.1 PASS`. That is not launch approval.

## 2. UTC timestamp

`2026-09-30T17:11:22Z`

## 3. Branch

`main`

## 4. HEAD

None. The branch has no commits yet.

## 5. Initial Phase 3.1 state

Phase 3 monitoring was in place. The websocket callback fetched and classified each signature on one promise chain, so intake and processing were the same path. There was no worker pool, no queue capacity, and no per-signature retry budget. Runtime state was `PRELAUNCH` with no canonical mint.

## 6. Files changed

- `packages/shared/src/ingest-queue.ts`
- `packages/shared/src/stress.ts`
- `packages/shared/src/ingest-queue.test.ts`
- `packages/shared/src/trade.ts`
- `packages/shared/package.json`
- `apps/worker/src/monitor.ts`
- `apps/worker/src/listener.ts`
- `apps/worker/src/ledger.ts`
- `apps/worker/src/runtime.ts`
- `apps/worker/src/health.ts`
- `apps/worker/src/health.test.ts`
- `scripts/monitoring-stress.ts`
- `scripts/monitoring-benchmark.ts`
- `scripts/lib/preflight.ts`
- `scripts/lib/launch-report.ts`
- `scripts/launch-preflight.ts`
- `scripts/launch-report.test.ts`
- `package.json`
- `docs/ARCHITECTURE.md`
- `docs/FINAL_PRELAUNCH_CHECKLIST.md`
- `docs/LAUNCH_MODEL.md`
- `reports/PHASE-3.1-CONCURRENCY-HARDENING.md`

## 7. Queue architecture

The websocket callback only enqueues a signature. A pool of 8 processors fetches the confirmed transaction, claims the signature in `processed_transactions`, and runs the existing parser. Completion order can differ from slot order. Each stored event keeps its slot. Downstream readers order by slot or time. Identity remains the signature.

## 8. Configured concurrency

`PROCESSOR_CONCURRENCY = 8`. This is a code constant in `packages/shared/src/ingest-queue.ts`, inside the required range of 5 to 10. It is not an environment variable.

## 9. Queue capacity and high-water strategy

Waiting work is capped at 2,000 signatures. At that point intake pauses and the socket closes instead of dropping a signature that has not been queued. Intake resumes when the waiting depth falls to 500. While all 8 processors are busy and signatures are still waiting, health reports `BACKLOGGED`. The in-memory queue and the recent-signature cache are lost on restart. Already stored signatures stay unique because of the database primary key.

## 10. Early duplicate suppression

A signature is remembered when it is queued. A later notification for the same signature is counted as a duplicate and does not start another fetch. The cache keeps the newest 5,000 signatures. It is an optimization. Supabase uniqueness is the durable rule.

## 11. Durable dedupe race behavior

`createSupabaseLedger` inserts with `upsert` on the signature primary key and `ignoreDuplicates`. It does not read the row and then insert it. Concurrent claims in the in-memory ledger coalesce on one in-flight promise, and a test of 20 simultaneous claims inserts the row once. `npm run launch:preflight` read `processed_transactions` successfully.

## 12. Retry and backoff policy

Transient failures retry at most 3 times. The waits are 200ms, then 800ms, then 2s. Retried classes are RPC errors, a transaction that is not yet fetchable, and temporary Supabase failures, including a thrown ledger error. Parser results, failed transactions, and unrelated transactions are stored once and are not retried. A deterministic permanent failure stops on the first attempt. After the third transient failure the signature is counted as a failure and is not retried again.

## 13. Transaction-availability retry behavior

A null confirmed transaction is `unavailable`. The first miss is a retry, not a permanent failure. The stress mix includes 20 signatures that miss once and then classify.

## 14. Ordering model

Processors may finish out of slot order. The event stores the slot from the confirmed transaction. Duplicate identity is the signature. Ingestion is not serialized to force completion order.

## 15. Stress harness design

`npm run monitoring:stress` runs 1,000 synthetic signatures through the same queue, with instant backoff so the run stays deterministic. The mix is 400 unique buys, 200 unique sells, 200 duplicate buy notifications, 80 irrelevant transactions, 50 failed transactions, 40 one-time RPC misses, 20 one-time unavailable fetches, and 10 permanent failures. No live token, no Solana write, no OpenAI call, and no production mutation. `npm run monitoring:benchmark` prints timing for the same run and is not a throughput gate.

## 16. Stress input count

`1000`

## 17. Unique signature count

`800` unique signatures were submitted. `790` durable rows were stored. The other 10 were the permanent failures, which stop before a claim.

## 18. Duplicate count

`200` duplicate submissions. Each collapsed before processing.

## 19. Peak queue depth

`792`

## 20. Maximum observed concurrency

`8`

## 21. Retry count

`60`

## 22. Permanent failure count

`10`

## 23. Queue-drain result

`PASS`. Depth 0, active processors 0, and no delayed retries left.

## 24. Health and backlog behavior

Worker status now includes queue depth, active processors out of 8, processing state (`IDLE`, `ACTIVE`, `BACKLOGGED`, or `DEGRADED`), and processed, duplicate, retry, and failure counts. During `PRELAUNCH` the listener stays `IDLE` with reason `token not live`. `launch:status` reports static readiness: queue capacity `READY`, concurrency `8`, backpressure `READY`. It does not invent a live queue depth from a worker that is not running.

## 25. Typecheck result

`PASS`

## 26. Lint result

`PASS`

## 27. Test result

`PASS`. 50 tests.

## 28. Build result

`PASS`

## 29. `launch:status` result

`PRELAUNCH`. Canonical mint `none`. Database `CONNECTED`. Runtime row `PASS`. Alchemy RPC and WSS `PASS`. Trade listener `IDLE`. Reason `token not live`. Queue capacity `READY`. Concurrency `8`. Backpressure `READY`. Exit 0. The status text says this is not launch approval.

## 30. `launch:preflight` result

`VERDICT: PHASE 3.1 PASS`. Durable dedupe, bounded concurrency, backpressure, and the stress harness passed. OpenAI reactions are `NOT IMPLEMENTED`. The final website is `NOT IMPLEMENTED`. The production worker is `NOT DEPLOYED`. Production readiness is `NOT PRODUCTION READY`. The output does not say the token is ready to launch.

## 31. Any blockers

None for this phase.

## 32. Explicit confirmations

- no deployment
- no Vercel changes
- no Render production changes
- no token activation
- no Solana writes
- no Pump launch
- no OpenAI calls
- no AI reactions
- no burn execution
- no DEX-paid mutation
- no secrets printed

`npm run launch:activate`, `npm run bit:burn`, and `npm run bit:dex-paid` still exit non-zero and refuse writes. `.env.local` remains gitignored.
