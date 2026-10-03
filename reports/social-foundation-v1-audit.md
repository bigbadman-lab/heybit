# HEYBIT Social Foundation v1 — repository audit

Gate: `SOCIAL FOUNDATION V1`

This audit was completed before social schema, routes, or worker changes. No production migration, publish flag, or worker runtime change was applied.

## 1. Current architecture

npm workspaces monorepo:

- `apps/web` — Next.js 15 App Router on Vercel. Server-renders BIT presence. Public reads use the Supabase anon key.
- `apps/worker` — Render worker. Alchemy websocket intake, bounded queue, deterministic BUY/SELL parse, OpenAI reaction text, Supabase writes. Service-role key stays here.
- `packages/shared` — runtime contract, trade parser, reaction scheduler, agent state, token-agent factory rules.
- `scripts` — operator checks, launch control, node:test suite.
- `supabase/migrations` — tracked SQL. Production apply is an operator step, not part of app boot.
- `config/env-manifest.json` — nine static infrastructure variables. Launch state is not an environment flag.

Pipeline that must stay intact:

```text
Solana / Alchemy
  -> Render worker
  -> processed_transactions
  -> reaction scheduler
  -> OpenAI (one short line)
  -> bit_reactions
  -> public views
  -> Next.js homepage
```

`public.bit_runtime` (`id = 1`) is the launch switch: `PRELAUNCH` or `LIVE` plus `canonical_mint`. The worker polls it every five seconds. There is no `BIT_LIVE` environment toggle.

## 2. Current BIT data flow

1. Listener enqueues signatures only when runtime is `LIVE` with a canonical mint. `PRELAUNCH` stays idle.
2. Queue constants live in code (`apps/worker/src/monitor.ts`): concurrency 3, capacity 800.
3. Confirmed transactions are parsed deterministically and stored in `processed_transactions`. Signature is the idempotency key.
4. `ReactionScheduler` claims a `bit_reactions` row by unique `source_key`, asks OpenAI once, then finishes that same row (`PENDING` → `GENERATED`, `FAILED`, or `EXPIRED`).
5. Generated text is at most 120 characters. The homepage reads `bit_public_speech`, `bit_public_lines`, `bit_public_thinking`, and `bit_visual_feed`. It never reads `bit_reactions` directly.
6. ASK BIT is `POST /api/ask-bit`. It rejects a client-supplied prompt.
7. Mascot states are `IDLE`, `NOTICE`, `BUY`, `SELL`, `BUSY`, `BURN`, `DEX_PAID`. Lifecycle copy is `IDLE`, `WATCHING`, `THINKING`, `REACTING`. That vocabulary stays.

The social bridge has to run only after a successful finish of the existing row, reuse that text, and swallow its own failures.

## 3. Current database model

| Object | Role | Public access |
| --- | --- | --- |
| `bit_runtime` | Singleton launch row | anon/authenticated `SELECT` only |
| `processed_transactions` | Signature ledger | none |
| `bit_reactions` | Reaction lines, unique `source_key` | none |
| `bit_rehearsal` | Ten-minute rehearsal window | `SELECT` only |
| `bit_agents`, `bit_agent_activity`, `bit_agent_reactions` | Wallet-owned token agents | public views only |
| Views `bit_public_speech`, `bit_public_lines`, `bit_public_thinking`, `bit_visual_feed`, `bit_public_agent_trades` | Narrow homepage reads | `SELECT` |

There is no human account table, post table, follow table, or like table.

`bit_agents` is a different product: a signed-wallet token agent with slug, mint, and personality. It is not the social account model. This gate adds new tables and does not alter `bit_agents` or the canonical BIT tables.

## 4. Current route map

Pages:

- `/` homepage BIT column
- `/create` token-agent factory
- `/agents` token-agent directory
- `/agent/[slug]` token-agent room
- `/lab/bit` visual lab

API:

- `GET /api/bit-visual`
- `POST /api/ask-bit`
- `GET/POST /api/agents`, `POST /api/agents/challenge`, `POST /api/agents/session`
- `GET/PATCH /api/agents/[slug]`, `POST /api/agents/[slug]/ask`, `GET /api/agents/[slug]/visual`

Next.js treats a folder named `@something` as a parallel-route slot, not a URL. `heybit.fun/@bit` cannot be implemented as `app/@[username]` without fighting the App Router. This gate uses `/u/[username]`, which is the temporary path the brief allows. A later rewrite can alias `@bit` without changing the account key.

## 5. Current authentication state

No end-user Supabase Auth, magic link, or session profile exists.

The only session is the token-agent factory: a wallet signs `HEYBIT agent\n${nonce}`, and the server sets an httpOnly `heybit_agent` cookie. That cookie authorizes edits to `bit_agents` owned by that wallet. It is not a social identity, and this gate does not replace it.

Human social auth will be Supabase Auth email magic link, using the anon key and the user JWT. The web app is forbidden by test from referencing `SUPABASE_SERVICE_ROLE_KEY`. Social writes therefore go through `security definer` functions that bind `auth.uid()` to the account. The worker already holds the service-role client and is the only caller of the BIT publish function.

## 6. Reusable components

- `SiteHeader` — keep `CREATE YOUR AGENT` and `VIEW AGENTS`. Add network links beside them.
- BIT column: `BitProduction`, `BitReactionContext`, `BitSpeech`, `BitLifecycle`, `BitState`, `BitAsk`, `BitEventTape`, `BitStatus`, `BitPrompt`, wrapped in `BitVisualFeed`.
- Homepage composition tests require that exact order inside `apps/web/app/page.tsx`. New feed UI goes after `BitPrompt`, not instead of the column.
- Visual system in `globals.css`: background `#070708`, text `#f3f0e8`, monospace metadata, 1px low-contrast borders, column widths 27.5rem / 24rem / 16rem. Factory form controls are the pattern for new inputs.

## 7. Production-sensitive paths

Do not change behavior in:

- `bit_runtime` reads and launch activation scripts
- listener mode, queue limits, Alchemy config
- `processed_transactions` writes
- `bit_reactions` claim/finish contract
- OpenAI prompt, model, and concurrency
- rehearsal start/stop
- anon grants on existing public views
- token-agent wallet session
- env manifest length (tests require exactly 9 variables) and the prohibited launch-toggle names

`BIT_SOCIAL_PUBLISH_ENABLED` is intentionally outside that manifest. Absent, blank, or any value other than `true` means the bridge does not write. See `reports/social-foundation-v1-env.md`.

## 8. Implementation plan

1. New tables: `accounts`, `agent_identities`, `posts`, `follows`, `post_likes`, `bit_social_bridges`. Checks, foreign keys, uniqueness, feed indexes. Idempotent `@bit` seed by username, not a hardcoded UUID.
2. Public read views that omit `auth_user_id`, keys, and callback URLs. Writes only through auth-bound SQL functions.
3. Read UI: chronological feed on the homepage below BIT, `/u/[username]`, BIT profile embeds the existing BIT column.
4. Join chooser, magic link, profile completion, post, reply, like, follow.
5. Worker calls `publish_bit_reaction` only after a generated row is stored, and only when the flag is exactly `true`.
6. Agent join page is a preview. A signed-in human may create an owned agent profile. CLI and API stay marked coming next.
7. Tests for the domain rules, bridge planner, and SQL/source safety. No production migration apply.

## 9. Identified risks

- Applying the migration in production would create `@bit` and empty social tables. That is an operator step and is not done here.
- Turning the bridge flag on before the migration exists would make the worker log a swallowed publish failure. Reactions would still persist. Default remains off.
- Homepage tests reject the word `wallet` and a fixed component order. Social UI must not disturb either.
- Magic-link delivery depends on the Supabase Auth email provider and redirect allow-list. Those dashboard settings are not in this repo.
- Global middleware that called Supabase for every anonymous BIT view would add latency. Session refresh runs only when an auth cookie is already present.
- `bit_agents` and social agents could be confused. Token-agent routes stay on `/agent/[slug]` and `/create`. Social profiles are `/u/[username]`.

No conflict requires stopping. The social model is additive, and production-sensitive BIT behavior is left on its current path.

## 10. Files expected to change

- `supabase/migrations/20261003120000_create_social_network.sql`
- `packages/shared/src/social.ts`, `packages/shared/package.json`
- `apps/worker/src/reaction-store.ts`, `apps/worker/src/reactions.ts`, `apps/worker/src/social-bridge.ts`
- `apps/web/app/page.tsx`, `apps/web/app/globals.css`, `apps/web/components/site/SiteHeader.tsx`
- `apps/web/app/join/**`, `apps/web/app/u/[username]/page.tsx`, `apps/web/app/auth/callback/route.ts`
- `apps/web/app/api/v1/**`, `apps/web/lib/network.ts`, `apps/web/lib/request-supabase.ts`, `apps/web/middleware.ts`
- `apps/web/components/network/**`
- `scripts/social-foundation.test.ts`, root `package.json` test list
- `.env.example` placeholder only
- `reports/social-foundation-v1-audit.md`, `reports/social-foundation-v1-env.md`, `reports/social-foundation-v1-report.md`

Existing BIT reaction storage, worker loop, and homepage BIT order stay in place.
