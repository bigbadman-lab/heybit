# HEYBIT agent factory v1

## 1. Verdict

`PASS — AGENT FACTORY V1 IMPLEMENTED`

Users can create a token agent from a signed wallet session, open `/agent/[slug]`, and ask it fixed questions. The original BIT path is unchanged. This is not deployed, and the registry migration was not applied.

## 2. UTC timestamp

`2026-10-02T18:22:06Z`

## 3. Branch + HEAD

`main` at `fb93646c3509293eddedaffe0250a076805ec8fb`

`fix: hold the bit intro before the market line`

The factory work is uncommitted local work on top of that SHA. It was not pushed.

## 4. Current original BIT runtime state

`npm run launch:status`:

```text
Canonical mint ....... none
Launch state ......... PRELAUNCH
Trade listener ....... IDLE
Reaction scheduler ... IDLE
VERDICT .............. PRELAUNCH
```

The local homepage still shows PRELAUNCH, the BIT intro path, and the new factory links under the existing column.

## 5. Agent registry schema

`supabase/migrations/20261002200000_create_bit_agents.sql` adds:

- `public.bit_agents` with slug, name, token mint, personality, avatar, accent, owner wallet, and status `ACTIVE` or `PAUSED`
- `public.bit_agent_activity` for that agent's trades, including the signature only on the private table
- `public.bit_agent_reactions` for that agent's lines

Checks cover mint shape, wallet shape, name length, slug shape, the six personalities, the avatar and accent allowlists, and status. Indexes cover slug uniqueness, token mint, owner wallet, and status. `bit_runtime` is not altered.

Anon has no grants on the base tables. Public views are `bit_public_agents`, `bit_public_token_agent_trades`, and `bit_public_agent_lines`. They omit the owner wallet, internal ids, signatures, prompts, and models. `bit_public_agent_trades` stays the canonical BIT market view.

## 6. Ownership/auth model

There was no server-verifiable wallet session, so v1 uses a short signed challenge:

1. `POST /api/agents/challenge` with the wallet address returns a nonce bound to that wallet.
2. The wallet signs `HEYBIT agent` plus the nonce.
3. `POST /api/agents/session` checks the nonce and the ed25519 signature, then sets an httpOnly cookie.

Create and edit read the wallet from that cookie. A wallet field in the create JSON is rejected. No email accounts, no custodial wallets, and no private keys are stored.

## 7. Creation flow

`/create` is one page: token mint, name, personality, avatar, accent, deterministic preview, then `CREATE AGENT`.

`POST /api/agents` validates the allowlisted body, builds a unique slug (`name`, then `name-2`, `name-3`), and inserts one `ACTIVE` row. Success redirects to `/agent/[slug]`. The browser check showed the preview for `MOGBIT` / `DEGEN`, including `i’m MOGBIT`. The form was not submitted, so no production agent was created.

## 8. Personality presets

`DEADPAN`, `DEGEN`, `ANALYST`, `CHAOTIC`, `PARANOID`, and `DRY`.

Each preset is a fixed tone line. Every generated instruction still starts with the existing BIT rules: no advice, no price prediction, no invented facts. A value that is not one of the six presets is ignored and does not become prompt text. The create API rejects any extra field, including a system prompt.

## 9. Shared-engine design

`packages/shared/src/factory.ts` holds validation, slug rules, caps, intros, and roster selection. State and ASK facts still come from `deriveAgent` and `deterministicAsk`. User agents do not read `bit_runtime`.

Original BIT reactions stay on the existing scheduler. A user agent passes only its allowlisted preset into `ReactionFacts.style`. The worker appends that preset's fixed tone. The original BIT call leaves `style` unset and keeps the current prompt.

## 10. Worker multi-agent design

One process. The canonical BIT listener is unchanged. `startAgentRoster` loads up to 25 `ACTIVE` rows and, when that set is non-empty, opens one extra websocket for all of their mints. Logs are only a trigger. A signature is fetched and parsed for that mint. A null or failed fetch does not invent a trade. Parsed trades go to the schedulers whose mint matches. One thrown agent is caught and does not stop the loop or the BIT listener.

## 11. Active-agent cap

25 active agents globally, and 3 agents per wallet. A 26th active agent is skipped by the roster. Creation and un-pausing refuse when the cap is full.

## 12. Reaction storage design

User reactions and trades are new tables keyed by `agent_slug`. They are not written into `bit_reactions` or `processed_transactions`. Each reaction source key is unique per agent. Public line and trade views are filtered by slug. Agents do not read each other's rows.

## 13. Agent page route

`/agent/[slug]` shows the name, personality, mint, lifecycle, state, speech, recent observations, and the three ASK actions. The first visit types a session-scoped intro. An unknown slug, or a missing public view, renders `This agent is not available.`

## 14. ASK agent API

`POST /api/agents/[slug]/ask` accepts only `what_changed`, `what_watching`, and `summarise_15m`. Extra keys return 400. The answer is that agent's deterministic state, prefixed with the agent name. More than 8 calls per slug and client per minute returns 429. The website does not call OpenAI for ASK.

## 15. Directory implementation

`/agents` lists active public profiles and links to `/agent/[slug]`. No rankings or trading metrics. Until the migration exists, the page says the directory is unavailable. That is what the local page showed.

## 16. Homepage integration

BIT remains the hero. Under the existing column:

```text
CREATE YOUR AGENT
give your token a BIT.
VIEW AGENTS
```

The homepage source does not contain the word wallet.

## 17. Editing rules

`PATCH /api/agents/[slug]` lets the owner change name, personality, avatar, accent, and `ACTIVE` / `PAUSED`. The slug and token mint stay as created. A mint field is an unexpected field and is rejected. A non-owner is rejected. The wrong mint means creating a new agent.

## 18. Cost controls

User agents reuse the existing reaction cooldown, thresholds, and fallback. The roster cap is 25. ASK is rate limited. There is no LLM call for the preview or for website ASK. The worker logs active count, reactions generated, fallbacks, and skipped agents. A provider null is not turned into a spoken trade.

## 19. Failure isolation

A bad mint is skipped. A thrown observe is swallowed for that agent. A missing registry read logs `agent roster: unavailable` and leaves BIT's listener on its own socket. Public reads that fail return an unknown or unavailable agent instead of invented totals.

## 20. Migration files

One file, not applied:

`supabase/migrations/20261002200000_create_bit_agents.sql`

It does not change `bit_runtime`. Cursor did not run it.

## 21. Files changed

Factory implementation, uncommitted:

- `packages/shared/src/factory.ts`
- `packages/shared/src/reaction.ts`
- `packages/shared/package.json`
- `apps/worker/src/agent-roster.ts`
- `apps/worker/src/monitor.ts`
- `apps/worker/src/openai-reactions.ts`
- `apps/web/lib/agent-admin.ts`
- `apps/web/lib/agent-session.ts`
- `apps/web/lib/public-factory.ts`
- `apps/web/app/api/agents/route.ts`
- `apps/web/app/api/agents/challenge/route.ts`
- `apps/web/app/api/agents/session/route.ts`
- `apps/web/app/api/agents/[slug]/route.ts`
- `apps/web/app/api/agents/[slug]/ask/route.ts`
- `apps/web/app/api/agents/[slug]/visual/route.ts`
- `apps/web/app/create/page.tsx`
- `apps/web/app/agents/page.tsx`
- `apps/web/app/agent/[slug]/page.tsx`
- `apps/web/components/factory/CreateAgent.tsx`
- `apps/web/components/factory/AgentRoom.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `scripts/agent-factory.test.ts`
- `scripts/lib/preflight.ts`
- `package.json`
- `supabase/migrations/20261002200000_create_bit_agents.sql`

## 22. Tests added

`scripts/agent-factory.test.ts` covers creation, bad mint, bad personality, rejected prompt fields, slug collision, owner and non-owner edits, immutable mint, paused agents, all six presets, two-agent trade routing, separate memory, the 25 cap, log routing, a real ed25519 session, and the homepage / create / directory / ASK source constraints.

## 23. Full test/lint/typecheck/build results

```text
npm test          172 pass, 0 fail
npm run lint      pass
npm run typecheck pass
npm run build     pass
```

## 24. Local two-agent isolation proof

The test created `mog` on one mint and `bonk` on another. A buy on the first mint was spoken only as `DEGEN`. A sell on the second was spoken only as `ANALYST`. Their derived memories kept different lines and different buy counts. A signed ed25519 challenge verified the owner wallet and rejected the wrong message. No row was inserted into the production database. The create form was not submitted.

## 25. Confirmation original BIT still works

The homepage still renders BIT, PRELAUNCH, and the existing speech column, with the factory links added underneath. The canonical listener and `bit_runtime` path were not rewritten.

## 26. Confirmation no permanent BIT activation occurred

`launch:activate` was not run.

## 27. Confirmation canonical BIT mint unchanged

Launch status reports `Canonical mint ....... none`.

## 28. Confirmation no rehearsal started

`rehearsal:start` was not run.

## 29. Confirmation no env vars changed

No Vercel, Render, or local env file was edited.

## 30. Confirmation no new Vercel project created

No Vercel CLI command was run.

## 31. Confirmation no new Render service created

No Render service was created. The roster is code inside the existing worker and is not deployed.

## 32. Confirmation no Solana broadcast occurred

No transaction was built or sent. Wallet use is a signature over the login message only, and only inside the unit test.

## 33. Remaining blockers before deployment

The migration has to be applied by the operator before profiles, trades, or lines can be read or written. Until then the directory and agent page fail closed, which is what localhost showed.

Registry writes use the server credential already present for the worker. That credential is not on the Vercel project, so production `POST /api/agents` will stay unavailable until a later gate puts it on the web server without exposing it to the browser. This gate did not add it.

Review this before any deploy. Do not activate BIT in that deploy.

## 34. Recommended deployment gate

Review the factory, have the operator apply `20261002200000_create_bit_agents.sql`, then deploy the existing Vercel project and Render worker without activation, recovery, or a rehearsal. Include the web server credential required for creates in that later gate, not in the client bundle.
