# HEYBIT — 10-minute live-site rehearsal

## 1. Verdict

`PASS — READY TO RUN 10-MINUTE REHEARSAL`

The rehearsal was not started.

## 2. UTC timestamp

2026-10-02T12:33:15Z

## 3. Branch + HEAD

`main` at `fff92bb` (`feat: keep a live event on one cue and link X`).

The rehearsal implementation is uncommitted. Production `https://heybit.fun` is still the previous deploy until this code is shipped.

## 4. Existing runtime architecture discovered

`public.bit_runtime` is a singleton (`id = 1`) with `launch_state` `PRELAUNCH` or `LIVE` and `canonical_mint`. `LIVE` requires a mint. Anon can select that row and cannot write it.

The worker polls that row every 5 seconds. `decideMonitoring` opens the Alchemy logs listener only when `launch_state` is `LIVE` and a canonical mint is present. Otherwise the listener stays idle with reason `token not live`. Each queued signature reads the runtime again before it writes the ledger or asks for a reaction. The reaction scheduler runs only while that gate is active. OpenAI is called from the worker for a claimed reaction, with a deterministic fallback when inference is unavailable.

`launch:activate`, `bit:burn`, and `bit:dex-paid` still refuse and do not broadcast. There is no rehearsal mode in the previous code, and no launch boolean in the environment manifest. The homepage reads the public runtime on each request. Local verification of the current site, with no rehearsal row, returned `PRELAUNCH`, `NOT LIVE`, `NOT LAUNCHED`, and presence `{ "launchState": "PRELAUNCH", "mint": null, "runtimeKnown": true }`.

## 5. Files changed

Rehearsal implementation:

- `packages/shared/src/rehearsal.ts`
- `packages/shared/src/reaction.ts`
- `packages/shared/package.json`
- `supabase/migrations/20261002130000_create_bit_rehearsal.sql`
- `scripts/rehearsal-start.ts`
- `scripts/rehearsal-status.ts`
- `scripts/rehearsal-stop.ts`
- `scripts/rehearsal.test.ts`
- `scripts/lib/preflight.ts`
- `apps/worker/src/runtime.ts`
- `apps/worker/src/monitor.ts`
- `apps/worker/src/reactions.ts`
- `apps/web/lib/public-supabase.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/api/bit-visual/route.ts`
- `apps/web/components/bit/use-bit-visual.tsx`
- `apps/web/components/bit/BitStatus.tsx`
- `package.json`
- `scripts/bit-market.test.ts`
- `scripts/bit-commentary.test.ts`
- `scripts/bit-token-actions.test.ts`
- `scripts/bit-terminal.test.ts`

Unrelated files already dirty before this work were left as they were: `.gitignore`, `apps/web/package.json`, `package-lock.json`, `reports/PRODUCTION-RENDER-WORKER-AUDIT.md`.

## 6. Rehearsal implementation

The temporary window lives in a new singleton table, `public.bit_rehearsal` (`id = 1`):

```text
mint
started_at
expires_at
stopped_at
```

The database requires `expires_at = started_at + interval '10 minutes'`. Anon can select. Anon cannot insert, update, or delete. The start and stop commands use the service role and write only this table.

On every read, `resolveEffective(permanent, rehearsal, now)` decides:

- Official `bit_runtime.launch_state = LIVE` stays the effective token. A rehearsal record cannot replace that mint.
- Otherwise an unstopped row with `now < expires_at` and a span of exactly 600000 ms is mode `REHEARSAL`. The website and the worker treat that mint as the live token.
- At `expires_at`, or after `rehearsal:stop` sets `stopped_at`, the effective state is the permanent row again.

The website evaluates this in `readPublicPresence` on the homepage render and on every `GET /api/bit-visual`. The open tab applies that server payload. The browser does not keep its own expiry clock.

The worker evaluates it inside `loadWorkerRuntime` on each 5-second tick and again at the start of every queued signature. While the window is open the log says `runtime state: REHEARSAL` and the listener subscribes to the rehearsal mint. `launch:status` still reads `bit_runtime` only, so it continues to show `PRELAUNCH` and `canonical mint: none`.

No new environment variable is required.

## 7. Automatic expiry proof

`scripts/rehearsal.test.ts` uses a fixed start of `2026-10-02T12:00:00.000Z`.

- One millisecond before `expires_at`, the supplied mint is effective and public presence is `LIVE` with that mint.
- At `expires_at`, and one millisecond after, mode is `PRELAUNCH`, the effective mint is null, and the listener gate is idle.
- A stored span other than exactly 10 minutes is ignored.
- After `hold()`, a queued reaction is not inferred and is not stored as `GENERATED`. An inference already inside the model finishes as `EXPIRED` with no text.
- `processSignature` re-checks the gate before `reactions.note`. When the gate is idle it returns done and does not write the ledger.

Signatures already sitting in the in-memory queue do not keep the token live. The next process step reads the clock, finds the window closed, and drops the signature. The listener is stopped on the next tick.

## 8. Permanent-state isolation proof

`resolveEffective` returns the same permanent object it was given. Tests keep `launchState: PRELAUNCH` and `canonicalMint: null` on that object while the rehearsal is effective.

`rehearsal:start` selects the permanent row through `getBitRuntime` and upserts `bit_rehearsal` only. The start, stop, and status scripts do not mention `bit_runtime`, `canonical_mint`, or `launch_state`. The migration comment is `Does not alter bit_runtime, processed_transactions, or bit_reactions.` and the SQL does not `alter table public.bit_runtime`.

If the permanent row is already `LIVE`, start refuses with `Permanent launch is already live. Rehearsal refused.` and the official mint stays the effective mint.

A second start while a window is still open refuses with `A rehearsal is already active.`

## 9. Commands

Before:

```bash
npm run rehearsal:status
```

Start the 10-minute window:

```bash
npm run rehearsal:start -- XLBLxbY1Mr7aadnqAbmqSBXLEyUdjvUXtXCnz8Mpump --duration=10m
```

During:

```bash
npm run rehearsal:status
```

Optional abort:

```bash
npm run rehearsal:stop
```

After expiry, or after abort:

```bash
npm run rehearsal:status
```

`launch:status` remains the permanent-row check and should stay `PRELAUNCH` for this rehearsal.

Any duration other than `--duration=10m` is rejected. An invalid mint is rejected. Stop is safe to repeat: an absent or already inactive record exits 0.

## 10. Vercel / Render impact

No new environment variable on either platform.

Vercel needs a deploy of this code before `https://heybit.fun` can show the rehearsal mint and drop it at expiry. The current production deploy does not contain this read.

Render needs a worker process built from this code and restarted so the listener follows the row. No Render env edit is required. The worker was not created or restarted here.

Supabase needs `supabase/migrations/20261002130000_create_bit_rehearsal.sql` applied by the operator. It was not applied. Until that table exists, start exits with `Rehearsal storage is not ready.` and the site stays on the permanent `PRELAUNCH` row. Local `GET /api/bit-visual` confirmed that missing-table path: presence stayed `PRELAUNCH` with a null mint.

## 11. Tests / lint / build results

- `npm test` — 119 pass, 0 fail
- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm run build` — pass. Homepage route `/` is 4.88 kB, first load 113 kB
- `npm run env:check` — `VERDICT: PASS` (presence only; values not printed)

Local homepage HTML after the dev server restart contained `PRELAUNCH`, `NOT LIVE`, `NOT LAUNCHED`, and did not contain the rehearsal mint.

## 12. Final operator sequence

1. Apply `supabase/migrations/20261002130000_create_bit_rehearsal.sql`.
2. Commit and deploy this code to Vercel. Restart the Render worker from the same code.
3. `npm run rehearsal:status` and confirm `effective live ....... NO`.
4. `npm run rehearsal:start -- XLBLxbY1Mr7aadnqAbmqSBXLEyUdjvUXtXCnz8Mpump --duration=10m`
5. `npm run rehearsal:status` during the window. The public site should show the rehearsal mint, market `LIVE`, and the Solscan and copy actions. The worker log should say `runtime state: REHEARSAL`. `npm run launch:status` should still say `PRELAUNCH`.
6. Optional: `npm run rehearsal:stop`
7. When the clock passes `expires_at`, `npm run rehearsal:status` should show `remaining expired`, `effective live NO`, and both gates `IDLE`. The next page load and the open tab's following visual poll should return to `PRELAUNCH` and `NOT LAUNCHED`.
