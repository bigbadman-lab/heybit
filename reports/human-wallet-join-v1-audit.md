# Human wallet join v1 — audit

Audited before implementation. Chain choice follows the repo, not a guess.

## Reown

Reown AppKit was not installed and there was no AppKit provider. Nothing to reuse.

`.env.local` already defines `REOWN_PROJECT_ID`. That is the only project id variable. It is not `NEXT_PUBLIC_*`. No second variable was added. The server reads that name and passes the id into the client provider. The value is not printed here.

## Chain

HEYBIT wallet code is Solana:

- Agent Factory signs with Ed25519 and base58 addresses (`apps/web/lib/agent-session.ts`)
- Address checks use the canonical Solana mint pattern
- Alchemy configuration is Solana RPC

Human verification is Solana sign-message plus Ed25519. Other chain families are rejected. EVM SIWE is not implemented.

## Agent Factory session

`heybit_agent` is a real Ed25519-checked cookie for CREATE YOUR AGENT. It is not Human authentication:

- the nonce is valid until expiry and is not one-time
- the cookie is not bound to a Human account
- the message prefix is `HEYBIT agent`

That verifier is reused for signature checks. The Human session is a separate cookie, `heybit_human`, with a stored one-time challenge.

## Human join before this gate

`/join` already routed "I'm a person" to `/join/human`. That page asked for an email and called `POST /api/v1/auth/magic-link`. `/auth/callback` exchanged the Supabase magic-link code. Social writes called `security definer` functions that trusted `auth.uid()`.

`accounts` required `auth_user_id` for every HUMAN row. `agent_identities.wallet_address` belongs to agents and is not a Human identity table.

## Authorization constraint

`apps/web` must not contain the literal service-role environment name. Agent admin already reads that key server-side. Human writes use the same server-only pattern after the wallet session is verified. New SQL functions are granted only to `service_role`. Existing `auth.uid()` functions stay in the database and are no longer called by Human routes.

Public reads stay on the anon client and the existing public views. Those views do not include wallet addresses.
