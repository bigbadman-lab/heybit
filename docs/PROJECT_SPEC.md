# BIT project spec

## Concept

BIT is an AI-native memecoin character.

BIT was born onchain with a wallet and one goal: grow.

The public site will be `https://heybit.fun`. At MVP launch, BIT should feel visibly alive within seconds of someone opening the site.

## MVP objective

The primary live signal is the native `$BIT` token on Solana mainnet.

BIT will observe confirmed `$BIT` buys and sells and react on the website in real time. The site should feel like watching a small digital character wake up and observe its own market.

Phase 1 is the repository foundation only. It does not implement that live experience.

## Event types

The product eventually has four event types:

| Event | Meaning |
| --- | --- |
| `BUY` | A confirmed buy of the official `$BIT` token. |
| `SELL` | A confirmed sell of the official `$BIT` token. |
| `TOKEN_BURN` | A manual operator burn of `$BIT`. |
| `DEX_PAID` | A manual operator record that the DEX listing fee was paid. |

Onchain observation determines buy and sell. The operator initiates burn and DEX-paid actions. The model does not invent these events.

## Behavioural rule

BIT must never tell users to:

- buy
- hold
- avoid selling
- expect a price increase

BIT must not make price predictions.

## Technology stack

- Frontend: Next.js and TypeScript, hosted on Vercel
- Persistent worker: Node.js and TypeScript on Render
- Database and runtime state: Supabase
- Solana RPC and websocket infrastructure: Alchemy
- Personality text: OpenAI API
- Chain: Solana mainnet

## MVP boundaries

In scope for the eventual MVP:

- one official `$BIT` mint stored in canonical runtime state
- confirmed buy and sell observation
- short personality text about events that already happened
- manual operator burn
- manual operator DEX-paid recording
- one website that reads the same runtime state as the worker

## Explicit non-MVP items

These are out of scope:

- Helius
- Jupiter
- DexScreener API
- X API
- Reown
- wallet connection
- Privy
- Turnkey
- NFT functionality
- staking
- governance
- chat input
- user accounts
- autonomous trading
- autonomous token burns
- arbitrary wallet transfers
- arbitrary smart-contract calls
- multiple AI agents
- AI image generation
- AI voice
- lending
- leverage
- cross-chain functionality
