# Phase 2 — Canonical runtime state

## 1. Verdict

`BLOCKED`

The Phase 2 code, migration, and read-only checks are in place. The canonical row is not verifiable yet because the migration has not been applied. Runtime reads were not faked as PASS.

## 2. UTC timestamp

`2026-09-30T16:30:38Z`

## 3. Branch

`main`

## 4. HEAD

None. The branch has no commits yet.

## 5. Initial Phase 2 state

Phase 1 and Phase 1.1 were already in the working tree: Next.js placeholder, worker skeleton, shared contracts, env manifest, root `.env.local` loader, and refusing mutation commands. `supabase/` contained only `.gitkeep`. There was no runtime table and no Supabase project link.

## 6. Files changed

- `supabase/migrations/20260930161700_create_bit_runtime.sql`
- `packages/shared/src/index.ts`
- `packages/shared/src/bit-runtime.test.ts`
- `packages/shared/package.json`
- `scripts/lib/supabase.ts`
- `scripts/lib/launch-report.ts`
- `scripts/lib/preflight.ts`
- `scripts/launch-status.ts`
- `scripts/launch-preflight.ts`
- `scripts/supabase-check.ts`
- `scripts/launch-report.test.ts`
- `scripts/client-safety.test.ts`
- `scripts/commands.test.ts`
- `apps/web/lib/public-supabase.ts`
- `apps/web/app/page.tsx`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `apps/worker/src/health.ts`
- `apps/worker/src/health.test.ts`
- `apps/worker/src/runtime.ts`
- `apps/worker/src/index.ts`
- `apps/worker/package.json`
- `package.json`
- `package-lock.json`
- `docs/ARCHITECTURE.md`
- `docs/LAUNCH_MODEL.md`
- `docs/ENVIRONMENT.md`
- `docs/FINAL_PRELAUNCH_CHECKLIST.md`

## 7. Migration created

`supabase/migrations/20260930161700_create_bit_runtime.sql`

It was not applied.

## 8. Runtime table structure

`public.bit_runtime`, one row, `id = 1`.

- `id`
- `canonical_mint`
- `launch_state`
- `activation_timestamp`
- `launch_signature`
- `launch_slot`
- `created_at`
- `updated_at`

The seed row is `PRELAUNCH` with a null mint and null activation metadata. It does not set `LIVE`.

## 9. Database invariants

- `id` must be `1`, so only one canonical row can exist
- `launch_state` is `PRELAUNCH` or `LIVE`
- `LIVE` requires a non-null `canonical_mint`
- mint text must match a Solana public-key shape when present
- `launch_slot` is a non-negative `bigint` or null
- `updated_at` is set on update

## 10. RLS / access model

Row Level Security is enabled.

- `anon` and `authenticated` may `SELECT`
- `anon` and `authenticated` are revoked from `INSERT`, `UPDATE`, and `DELETE`
- no anon write policies exist
- service-role access stays on the server and operator CLI

The web server reads with the anon key. It does not reference `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, or `BIT_DEPLOYER_KEYPAIR_PATH`. Those names are absent from `apps/web` source and from the client static build.

## 11. Shared runtime types

`packages/shared` exports `BitLaunchState`, `BitRuntime`, `parseBitRuntime()`, and `getBitRuntime()`.

## 12. Runtime repository / service location

`getBitRuntime()` in `packages/shared/src/index.ts` is the only `bit_runtime` query. It selects the singleton row and does not write.

Service-role and anon clients for the CLI are created in `scripts/lib/supabase.ts`.

## 13. `launch:status` behaviour

Reads `bit_runtime` and prints public fields only. A failed read exits non-zero and does not print database error details.

This run connected and did not find a valid runtime row:

```text
Database ............. CONNECTED
Runtime row .......... FAIL
VERDICT: BLOCKED
```

## 14. `launch:preflight` behaviour

Read-only. This run:

```text
Local env ............ PASS
Supabase ............. PASS
Runtime schema ....... FAIL
Runtime row .......... FAIL
VERDICT: PHASE 2 BLOCKED
```

Alchemy, OpenAI reactions, worker production, and the final website are reported as not implemented. The output does not say the token is ready to launch.

## 15. Web read path

`apps/web/app/page.tsx` is a dynamic server render. It reads the same runtime row through the anon key. A local request returned:

```text
BIT runtime: unavailable
Official mint: unavailable
```

That is the graceful error state while the table is missing. The response did not contain privileged env names or a token prefix.

## 16. Worker read path

Startup loads root `.env.local`, reads `bit_runtime` with the service-role key, and logs launch state plus canonical mint. Failures stay on the safe unavailable line. The process keeps running. It does not call Alchemy or OpenAI and it does not write.

## 17. Health-model update

Worker health now reports `process`, `supabase`, and `runtimeState`. Alchemy and OpenAI are not marked healthy.

## 18. Commands added / changed

Added `npm run supabase:check`.

`launch:status` and `launch:preflight` now read canonical runtime state.

`launch:activate`, `bit:burn`, and `bit:dex-paid` still refuse. Each exited 1. No writes were performed.

## 19. Tests added

Runtime parsing and invariants, repository mapping with a mock client, missing and malformed rows, launch-status formatting, preflight wording, worker health, and a source scan that privileged env names stay out of `apps/web`.

## 20. Typecheck result

PASS. Exit code 0.

## 21. Lint result

PASS. Exit code 0.

## 22. Test result

PASS. 28 tests, 0 failures.

## 23. Build result

PASS. The homepage is a dynamic server route. Worker and shared builds completed.

## 24. `env:check` result

PASS. Values were not printed.

## 25. Supabase / runtime-state verification result

`npm run supabase:check` returned `VERDICT: BLOCKED`.

The service-role and anon reads both failed because the runtime table is not present. No row was written.

## 26. Migration application status

Not applied.

`supabase/config.toml` is absent, so the repo is not linked to a Supabase project. The migration was not pushed.

## 27. Operator action required

Apply `supabase/migrations/20260930161700_create_bit_runtime.sql` to the Supabase project used by the local environment, then run `npm run supabase:check`.

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push
npm run supabase:check
```

The same SQL file can be run in that project's SQL editor instead of `supabase db push`.

## 28. Explicit confirmations

- no deployment
- no Vercel changes
- no Render changes
- no Solana writes
- no token creation
- no Pump launch
- no Alchemy monitoring
- no OpenAI calls
- no production activation
- no burn execution
- no DEX-paid mutation
- no secrets printed
