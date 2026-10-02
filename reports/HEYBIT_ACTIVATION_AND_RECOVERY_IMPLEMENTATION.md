# HEYBIT activation and recovery implementation

## 1. Verdict

`PASS — ACTIVATION AND RECOVERY CONTROLS IMPLEMENTED`

The commands exist locally and were proven with mocks. Production was not activated.

## 2. UTC timestamp

`2026-10-02T16:38:21Z`

## 3. Branch + HEAD

`main`, still `4ce4655287256933532f977eae07993d5317ebd4`.

The implementation is uncommitted local work on top of that SHA. It was not pushed.

## 4. Current permanent runtime

`npm run launch:status` at `2026-10-02T16:28:03Z`:

```text
canonical mint ....... none
launch state ......... PRELAUNCH
effective live ....... NO
worker listener ...... IDLE
reaction scheduler ... IDLE
verdict .............. PRELAUNCH
```

The stored rehearsal window remains expired. Effective live is NO.

## 5. Activation command syntax

```bash
npm run launch:activate -- <OFFICIAL_MINT> --confirm-production
```

```bash
npm run launch:activate -- --help
```

Help exits 0 and does not write.

## 6. Recovery command syntax

```bash
npm run launch:recover-prelaunch -- --confirm-production
```

```bash
npm run launch:recover-prelaunch -- --help
```

This is an emergency operator-only command. Help exits 0 and does not write.

## 7. Activation validation rules

The command refuses before any database client when:

- `--confirm-production` is missing
- the mint argument is missing
- the mint format is invalid
- an unrecognized argument is present

After a service-role read, it refuses when:

- service-role access is unavailable
- canonical runtime cannot be read
- rehearsal state cannot be read
- a rehearsal is still effective
- the row is already `LIVE`
- PRELAUNCH already has a canonical mint

The only accepted write is PRELAUNCH with a null mint, a valid mint, confirmation, and no effective rehearsal.

## 8. Duplicate/idempotency rules

- PRELAUNCH and a null mint: activation is allowed.
- LIVE with the same mint: `ALREADY LIVE — NO WRITE`. No write.
- LIVE with a different mint: `BLOCKED — DIFFERENT PERMANENT MINT ALREADY LIVE`. No write.
- PRELAUNCH with a non-null mint: refused. Recovery or audit is required. The mint is not overwritten.

The update itself is conditional on `id = 1`, `launch_state = PRELAUNCH`, and `canonical_mint` null.

## 9. Recovery guardrails

- The command name contains `recover`.
- `--confirm-production` is required.
- A positional mint is refused with `Recovery cannot set a mint.`
- The worker and the website do not call it.
- No environment boolean can trigger it.
- No scheduled job calls it.
- There is no fallback that runs it.
- It cannot set a replacement mint.
- Read-back failure exits non-zero.
- An already-clean PRELAUNCH row is refused with no write.
- A PRELAUNCH row that still has a mint is cleared back to null. That is the audit path for an unexpected mint.
- `docs/LAUNCH_MODEL.md` documents the command as emergency and operator-only.

## 10. Rehearsal interaction rules

- Activation refuses while `isRehearsalEffective` is true.
- `resolveEffective` still returns permanent `LIVE` ahead of an active rehearsal.
- `decideRehearsalStart` still returns `permanent-live` when the permanent row is `LIVE`.
- Recovery reads rehearsal only to print whether it is active. It does not insert, update, or delete `bit_rehearsal`.

## 11. Exact tables/columns written by activation

`public.bit_runtime` only, row `id = 1`:

- `launch_state = LIVE`
- `canonical_mint = <supplied mint>`

`activation_timestamp`, `launch_signature`, and `launch_slot` are not set. The existing `updated_at` trigger may touch `updated_at` on a real update. No other table is written.

## 12. Exact tables/columns written by recovery

`public.bit_runtime` only, row `id = 1`:

- `launch_state = PRELAUNCH`
- `canonical_mint = null`

No rehearsal row is written. No other table is written.

## 13. Confirmation no Solana broadcast exists

`launch-activate.ts`, `launch-recover-prelaunch.ts`, and `scripts/lib/launch-control.ts` do not contain `sendTransaction`, `requestAirdrop`, or `clusterApiUrl`. The verified success text says no Solana transaction was broadcast.

## 14. Confirmation no env boolean controls launch

Those files do not reference `BIT_LIVE`, `TOKEN_LIVE`, `MONITOR_ENABLED`, `REACTIONS_ENABLED`, `DEX_PAID`, `BROADCAST_ENABLED`, or `LAUNCH_ENABLED`. Service-role configuration is presence-only and is not a launch switch.

## 15. Read-back verification behaviour

Activation reads the row after the update. Success requires `launch_state = LIVE` and `canonical_mint` equal to the supplied mint. Anything else exits 1 and prints `ACTIVATION_READBACK_WARNING`, which names `npm run launch:recover-prelaunch -- --confirm-production`.

Recovery reads the row after the update. Success requires `launch_state = PRELAUNCH` and `canonical_mint = null`. Anything else exits 1 and prints `RECOVERY_READBACK_WARNING`.

## 16. Files changed

- `scripts/launch-activate.ts`
- `scripts/launch-recover-prelaunch.ts`
- `scripts/lib/launch-control.ts`
- `scripts/launch-control.test.ts`
- `scripts/commands.test.ts`
- `scripts/launch-report.test.ts`
- `scripts/null-fetch-surface.test.ts`
- `scripts/lib/preflight.ts`
- `scripts/lib/refuse.ts`
- `apps/worker/src/runtime.ts`
- `apps/web/app/api/bit-visual/route.ts`
- `apps/web/lib/visible-speech.ts`
- `docs/LAUNCH_MODEL.md`
- `package.json`
- `reports/HEYBIT_ACTIVATION_AND_RECOVERY_IMPLEMENTATION.md`

No migration was added.

## 17. Tests added

`scripts/launch-control.test.ts` covers missing and invalid mints, missing confirmation, help, an active rehearsal, mocked PRELAUNCH activation, read-back failure, same-mint and different-mint refusals, an unexpected PRELAUNCH mint, recovery confirmation, recovery of a clean row, recovery of a LIVE row, recovery of an unexpected mint, rehearsal priority, worker and website propagation, and the absence of a broadcast or launch boolean.

`scripts/commands.test.ts` still spawns the real activation script only with a mint that fails `isCanonicalMint`, so the process exits before a client is created.

## 18. Full test/lint/typecheck/build results

- `npm test`: 157 pass, 0 fail
- `npm run lint`: pass
- `npm run typecheck`: pass
- `npm run build`: pass
- `npm run launch:status`: PRELAUNCH, canonical mint none
- `npm run rehearsal:status`: expired, effective live NO

## 19. Mock activation proof

A mocked PRELAUNCH row with a null mint accepted `1` repeated 32 times, wrote only `{ launch_state: "LIVE", canonical_mint }`, kept the existing activation timestamp, signature, and slot, and passed read-back.

A read-back that stayed PRELAUNCH exited 1 with the recovery warning.

LIVE/same mint, LIVE/different mint, PRELAUNCH/non-null mint, and an active rehearsal all exited without a write.

## 20. Mock recovery proof

A mocked LIVE row became PRELAUNCH with a null mint. Read-back matched. The patch did not contain a replacement mint.

An already-clean PRELAUNCH row did not write.

A read-back that stayed LIVE exited 1.

The recovery source does not mention `bit_rehearsal`. The library updates only `bit_runtime`.

## 21. Worker propagation proof

`projectWorkerRuntime` on a LIVE row returns that mint and does not apply a rehearsal label. `decideMonitoring` listens. `listenerForRuntime` is ACTIVE. `reactionSchedulerMode` is ACTIVE.

The same helper on PRELAUNCH with a null mint stays idle, and the scheduler is IDLE.

## 22. Website propagation proof

`publicPresence` returns LIVE and the mint after the mocked activation, and `visiblePublicSpeech` returns the stored line.

After mocked recovery, presence is PRELAUNCH with a null mint, `visiblePublicSpeech` returns null, and `spokenLine` stays on the commentary pool.

## 23. Confirmation no production activation occurred

The real command was not run with a valid mint and `--confirm-production`. Help, invalid-mint, and recovery-with-a-positional invocations exit before `createServiceRoleClient()`.

## 24. Confirmation canonical mint remains none

`launch:status` reported `none`.

## 25. Confirmation permanent runtime remains PRELAUNCH

`launch:status` verdict remained PRELAUNCH.

## 26. Confirmation no rehearsal was started

No `rehearsal:start`. The stored window is still expired.

## 27. Confirmation no env vars changed

No local, Vercel, or Render variable was changed.

## 28. Confirmation no migration was run

No migration was required. The existing `bit_runtime` constraints already reject LIVE without a mint and reject a bad mint format.

## 29. Remaining blockers before deployment

- This implementation is not committed and is not on the production SHA. Production still runs the refusal stub.
- The official mint has not been supplied.
- These commands must not be executed against production until a later gate says so.

## 30. Recommended next gate

Review this implementation, then deploy it without running activation or recovery.

Do not run `npm run launch:activate` or `npm run launch:recover-prelaunch` against production in that deploy gate. The official mint is still an operator input for a later activation gate.
