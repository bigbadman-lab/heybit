# Environment

## Rule

```text
SECRETS / STATIC INFRA CONFIG -> ENVIRONMENT VARIABLES

DYNAMIC LAUNCH STATE -> SUPABASE
```

Environment variables hold static credentials and static infrastructure configuration only.

Launch state must never depend on env booleans.

Do not create variables such as:

```text
BIT_LIVE
TOKEN_LIVE
MONITOR_ENABLED
REACTIONS_ENABLED
DEX_PAID
BROADCAST_ENABLED
LAUNCH_ENABLED
```

There are zero launch-day boolean env toggles.

The official `$BIT` mint does not belong in `.env.local`, Vercel environment variables, or Render environment variables. It belongs in the Supabase `bit_runtime.canonical_mint` column.

## Source of truth

`config/env-manifest.json` is the machine-readable inventory. Each entry has:

- variable name
- destination (`local`, `render`, `vercel`)
- whether it is required
- a short description

The manifest contains no secret values.

Local operator commands automatically load the repository root `.env.local` before they inspect the environment. The file is ignored by Git. `.env.example` remains the committed template. Shell-exported variables take precedence over values in `.env.local`. No secret values should ever be committed. Root `.env.local` is for static local credentials and infrastructure config only. Dynamic launch state still belongs in Supabase.

`npm run env:check` reads the manifest and reports each required local variable as `PRESENT` or `MISSING`. It never prints values. It exits `0` only when every required local variable is present.

A variable marked required is required on every destination listed for it. Phase 1 checks the local destination only. Later phases can check Vercel and Render from the same file.

## Local

Required:

- `ALCHEMY_SOLANA_RPC_URL`
- `ALCHEMY_SOLANA_WSS_URL`
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BIT_DEPLOYER_KEYPAIR_PATH`

## Render

Required on the worker host:

- `ALCHEMY_SOLANA_RPC_URL`
- `ALCHEMY_SOLANA_WSS_URL`
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Vercel

Required for the public web app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

One concept has one canonical name. The `NEXT_PUBLIC_` prefix exists because the browser bundle can only read public variables. Those names are not aliases of the server credentials.

## Where secrets must not go

The deployer private key stays on the operator machine. `BIT_DEPLOYER_KEYPAIR_PATH` is only a local path. The key file must not be committed.

The deployer private key must never be placed in:

- Vercel
- Render
- Supabase
- frontend code

The browser must never receive:

- the Supabase service-role key
- the OpenAI API key
- the deployer private key
- privileged RPC credentials where avoidable

`.env.example` is the committed template. It contains blank placeholders only. Real `.env` files are gitignored.

The migration in `supabase/migrations/` defines `bit_runtime`. Applying it is a separate operator step. Phase 2 reads that row. It does not activate a launch.
