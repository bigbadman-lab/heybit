# Final prelaunch checklist

If something is required for launch, software must verify it.

The automated preflight is authoritative.

Human memory should not be treated as a launch dependency.

## What the final preflight will verify

The eventual `npm run launch:preflight` command will verify:

- local configuration
- production website health
- Render worker health
- Supabase connectivity
- Alchemy connectivity
- Alchemy RPC
- Alchemy WSS
- network/mainnet verification
- durable transaction table
- parser tests
- duplicate protection
- trade listener health
- OpenAI inference
- database schema
- canonical runtime state
- canonical runtime row exists
- state invariants are valid
- public website and worker read the same runtime source
- burn dry-run readiness
- DEX-paid tooling readiness
- Git cleanliness
- deployed commit alignment where practical

## Phase 3

Phase 3 can verify Alchemy RPC, Alchemy WSS, mainnet genesis, the trade parser, and the durable signature table after its migration is applied. The listener stays idle during `PRELAUNCH`. OpenAI reactions and the final website are not implemented. The production worker is not deployed.

## Phase 3.1

- bounded concurrency is a code constant of 8, inside the allowed range of 5 to 10
- backpressure pauses intake at a full queue instead of dropping a unique signature
- `npm run monitoring:stress` covers duplicate storms, temporary RPC failures, and delayed transaction availability
- retries use backoff and stop after three attempts
- backlog health reports queue depth and active processors without crashing the worker

`npm run launch:preflight` must not be treated as launch approval.
