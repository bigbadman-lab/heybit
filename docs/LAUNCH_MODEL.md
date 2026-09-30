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

Future authorized activation will set that same row:

```text
canonical_mint = official mint
launch_state = LIVE
activation metadata
```

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
| `npm run launch:activate` | Refuses. No writes. |
| `npm run bit:burn` | Refuses. No Solana transaction. |
| `npm run bit:dex-paid` | Refuses. No production state change. |

## Target flow

This flow is not implemented.

1. `npm run launch:preflight` must eventually return a final production PASS.
2. Launch the token through Pump.
3. `npm run launch:activate -- <OFFICIAL_MINT> --confirm-production` writes the official mint and `LIVE` state to `bit_runtime`.
4. `npm run launch:status` reports that canonical row.

Activation constraints:

- no launch-day Vercel env edits
- no launch-day Render env edits
- no flipping booleans from false to true
- no redeploy required simply to activate the official token

`npm run launch:activate` still refuses in this phase.
