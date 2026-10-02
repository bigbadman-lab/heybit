# Launch model

## Rule

Dynamic launch state lives in the Supabase table `bit_runtime`. Environment variables are not launch switches.

Before launch the singleton row is:

```text
canonical_mint = NULL
launch_state = PRELAUNCH
activation_timestamp = NULL
launch_signature = NULL
launch_slot = NULL
```

The operator activation command sets that same row:

```text
canonical_mint = official mint
launch_state = LIVE
```

`activation_timestamp`, `launch_signature`, and `launch_slot` are left unchanged.

That change does not edit Vercel or Render environment variables. It does not require a redeploy merely to activate the official token.

The worker polls `bit_runtime`. Monitoring is runtime-driven:

```text
PRELAUNCH -> listener IDLE, reaction scheduler IDLE

LIVE + canonical mint -> listener ACTIVE, reaction scheduler ACTIVE
```

No env toggle. No redeploy.

## Current commands

| Command | Behaviour |
| --- | --- |
| `npm run launch:status` | Reads `bit_runtime` and reports the listener gate. A pass is not launch approval. |
| `npm run launch:preflight` | Read-only Phase 4 checks. A pass is not launch approval. |
| `npm run monitoring:stress` | Synthetic 1,000-signature queue run. No live token and no writes. |
| `npm run reactions:stress` | Synthetic 1,000-trade reaction run. Mocked inference. No live token. |
| `npm run openai:check` | One controlled BIT line. Prints the sample only. |
| `npm run monitoring:benchmark` | Same synthetic run with timing. Diagnostic only, not a throughput gate. |
| `npm run supabase:check` | Read-only service-role and anon reads of the singleton row. |
| `npm run alchemy:check` | Read-only mainnet RPC slot read and websocket probe. |
| `npm run trade:inspect` | Read-only classification of one public signature. No writes. |
| `npm run launch:activate -- <OFFICIAL_MINT> --confirm-production` | Writes `bit_runtime` to `LIVE` with that mint when the row is PRELAUNCH, the mint is empty, and no rehearsal is active. Refuses every other case. No Solana broadcast. |
| `npm run launch:recover-prelaunch -- --confirm-production` | Emergency operator-only. Sets `bit_runtime` back to PRELAUNCH and clears `canonical_mint`. Does not accept a mint. Does not modify a rehearsal row. |
| `npm run bit:burn` | Refuses. No Solana transaction. |
| `npm run bit:dex-paid` | Refuses. No production state change. |

## Activation

```bash
npm run launch:activate -- <OFFICIAL_MINT> --confirm-production
```

The command refuses when the confirmation flag is missing, the mint is missing or invalid, a rehearsal is still effective, the row is already `LIVE`, or PRELAUNCH already has a canonical mint. A repeated call with the same live mint prints `ALREADY LIVE — NO WRITE`. A different mint prints `BLOCKED — DIFFERENT PERMANENT MINT ALREADY LIVE`. Neither call writes.

The write updates only `launch_state` and `canonical_mint` on `id = 1`, and only while that row is still PRELAUNCH with a null mint. It then reads the row back. A mismatch exits non-zero and names the recovery command.

`--help` prints usage and does not write.

## Recovery

```bash
npm run launch:recover-prelaunch -- --confirm-production
```

This is an emergency operator command. It is not called by the worker, the website, an environment variable, or a schedule. It cannot set a replacement mint. It prints the current launch state, canonical mint, and rehearsal status, then updates only `launch_state` and `canonical_mint` on `bit_runtime`. Read-back must show PRELAUNCH and a null mint. An already-clean PRELAUNCH row is refused.

## Target flow

1. `npm run launch:preflight` remains a read-only check. A pass is not launch approval.
2. Launch the token through Pump.
3. `npm run launch:activate -- <OFFICIAL_MINT> --confirm-production` writes the official mint and `LIVE` state to `bit_runtime`.
4. `npm run launch:status` reports that canonical row.

Activation constraints:

- no launch-day Vercel env edits
- no launch-day Render env edits
- no flipping booleans from false to true
- no redeploy required simply to activate the official token

Running either command against production is a separate operator gate. This document does not authorize that run.
