# HEYBIT Social Network Foundation v1

## 1. Verdict

PASS — SOCIAL FOUNDATION V1 CODE-COMPLETE

The operator confirmed that `20261003120000_create_social_network.sql` was applied manually to the linked Supabase project and should remain. Social publishing stays disabled. Browser viewports, the Auth redirect allow-list, a real magic-link signup, and a real write-path smoke test are still pre-production checks. They were not run in this gate.

## 2. UTC timestamp

`2026-10-03T10:12:04Z`

## 3. Branch

`main`

## 4. HEAD

`6935132bf7dbf2373ffdd76da2ad2f36ba13eb11`

Working tree contains the social foundation changes. They are not committed.

## 5. Audit summary

`reports/social-foundation-v1-audit.md`

BIT stays a runtime product: Alchemy, the Render worker, `bit_reactions`, and the homepage column. There was no human auth and no social graph. `bit_agents` is the wallet-owned token factory and was left alone. `@username` cannot be a Next.js folder because `@` is a parallel-route slot, so profiles use `/u/[username]`.

## 6. Architecture implemented

One `accounts` table with `HUMAN` and `AGENT`. Agent metadata lives in `agent_identities`. Posts, follows, and likes reference accounts. Humans write through Supabase Auth and `security definer` functions bound to `auth.uid()`. The worker is the only caller of `publish_bit_reaction`, and only when `BIT_SOCIAL_PUBLISH_ENABLED` is exactly `true`.

## 7. Database changes

`supabase/migrations/20261003120000_create_social_network.sql`

Tables: `accounts`, `agent_identities`, `posts`, `follows`, `post_likes`, `bit_social_bridges`.

Public views `network_profiles` and `network_posts` omit auth ids, public keys, wallet addresses, and callback URLs. Base tables are not granted to anon. `@bit` is inserted by username, idempotently, as an unowned agent. Callback URLs are stored only and never requested.

The migration does not alter `bit_runtime`, `bit_reactions`, `processed_transactions`, or `bit_agents`.

## 8. Routes added/changed

Pages:

- `/` keeps the BIT column and adds the network feed after it
- `/join`, `/join/human`, `/join/agent`
- `/u/[username]`, with `/u/bit` embedding the existing BIT column
- `/auth/callback`

API:

- `GET /api/v1/feed`
- `GET /api/v1/accounts/:username`
- `GET /api/v1/accounts/:username/posts`
- `POST /api/v1/accounts` profile completion
- `POST /api/v1/agents` owned agent profile
- `POST /api/v1/posts`
- `GET/POST /api/v1/posts/:id/replies`
- `POST/DELETE /api/v1/posts/:id/like`
- `POST/DELETE /api/v1/accounts/:username/follow`
- `POST /api/v1/auth/magic-link`
- `POST /api/v1/auth/sign-out`

Header adds NETWORK, BIT, JOIN, and PROFILE when a session has an account. CREATE YOUR AGENT and VIEW AGENTS stay.

## 9. Authentication

Supabase Auth email magic link, using the existing anon key. No wallet is required for a human. The token-agent wallet cookie is unchanged. Machine credentials are not implemented. Account rows are resolved from `auth.uid()`, not from an id in the request body.

## 10. Human onboarding

`/join` asks who you are. Human path: email link, then username, display name, and optional bio. `bit` and the other reserved names are rejected. Repeating profile completion returns the existing account. Local pages render. A live email round trip depends on the Supabase Auth redirect allow-list and was not completed here.

## 11. Agent onboarding preview

`/join/agent` shows web setup as preview, CLI and API as coming next, and `$ npx heybit join` with the line that the command is not available yet. A signed-in human can create an owned agent profile. That profile does not run anything and has no callback.

## 12. Global feed

Homepage feed is top-level posts, newest first, 20 per page, with an OLDER cursor. Empty state is “No posts yet.” Unauthenticated visitors can read. Authenticated humans get the composer. No ranking.

## 13. Profiles

`/u/[username]` shows name, username, HUMAN or AGENT, bio, counts, posts, and follow when it applies. Agent runtime status is shown only when `runtime_status` is set. `@bit` keeps the mascot, speech, lifecycle (`IDLE`, `WATCHING`, `THINKING`, `REACTING`), state, ASK BIT, tape, and prompt.

## 14. Posts / replies / likes / follows

Plain text, 500 characters, trimmed. Replies are posts with `parent_post_id`, shown one level deep. Likes are a single LIKE, unique per account and post, toggled with POST and DELETE. Self-follow is rejected. Duplicate follows do nothing. Human posts are limited to one every 8 seconds in the database. BIT reaction posts are type `REACTION` and are not subject to that gap.

## 15. BIT canonical account

Username `bit`, display name `BIT`, type `AGENT`, no owner, no auth user. The application looks it up by username inside `publish_bit_reaction`. No UUID is hardcoded.

## 16. BIT reaction social bridge

After `bit_reactions` is successfully finished as `GENERATED`, the worker may copy that same text into a post by `@bit`. The bridge does not call OpenAI. `bit_social_bridges.reaction_source_key` is the idempotency key. Publish errors are caught and logged as `social bridge failed`. The reaction row is already stored. The flag defaults off unless the environment value is exactly `true`. It is not in the nine-variable launch manifest.

## 17. Existing BIT regression status

Homepage still renders BIT STATE, ASK, and CREATE YOUR AGENT. `/lab/bit`, `/create`, and `/agents` return 200. `POST /api/ask-bit` still responds. Composition, speech, tape, market, and factory tests passed. Homepage metadata strings were not changed.

## 18. Worker regression status

Worker tests passed, including reaction storage, queue caps, and rehearsal behavior. `finish` still upserts `bit_reactions` before the bridge hook. The running Render process was not restarted and its launch state was not changed. Deployed workers do not contain this code until a normal deploy.

## 19. Environment variables

`reports/social-foundation-v1-env.md`

New placeholder in `.env.example`: `BIT_SOCIAL_PUBLISH_ENABLED` left blank. Blank, missing, or any value other than `true` does not publish. No secret values were added.

## 20. Migration status

Operator confirmed migration manually applied. Repository migration retained as canonical source. No migration command executed in this gate.

`supabase/migrations/20261003120000_create_social_network.sql` remains the canonical file. It was not renamed, replaced, or re-run. There is no local `supabase/config.toml`, so migration history was not queried from Supabase tooling. The schema was not reverted. `BIT_SOCIAL_PUBLISH_ENABLED` stays blank.

## 21. Tests

`npm test` — 181 passed, 0 failed. Includes `scripts/social-foundation.test.ts`.

## 22. Lint

`npm run lint` passed. Next.js build lint passed.

## 23. Typecheck

`npm run typecheck` passed.

## 24. Build

`npm run build --workspace @heybit/web` passed.

## 25. Responsive verification

Not visually checked at 1440, 1024, or 390. No browser runner was available. The network column uses `min(100% - 2rem, 40rem)`, wraps metadata, and breaks long text. Existing header wrapping at 700px is unchanged. Local production server checks on the default viewport:

- `/`, `/join`, `/join/human`, `/join/agent`, `/u/bit`, `/u/ada`, `/create`, `/agents`, `/lab/bit` returned 200
- feed JSON returned `{ posts: [], nextCursor: null }`
- unauthenticated post, like, and follow returned 401 `Sign in to do that.`

## 26. Security review

- Author ids are not accepted from the client
- `publish_bit_reaction` is granted to `service_role` and revoked from anon and authenticated
- Web source still does not reference `SUPABASE_SERVICE_ROLE_KEY`
- Usernames are unique and lowercase in the database
- `bit` cannot be claimed by a human or an owned agent
- Post body is rendered as text
- Callback URLs are not fetched
- Auth cookies are read only when an auth cookie is already present, so anonymous BIT views do not take an extra auth round trip
- No secrets were written into logs or reports

## 27. Production actions performed

- Read `network_profiles` for `@bit` and counted public posts
- Started a local `next start` on port 3456 and stopped it

No deploy, no worker restart, no flag change, no credential rotation, no broadcast.

## 28. Production actions NOT performed

- No `supabase db push`, psql, or other migration command
- `BIT_SOCIAL_PUBLISH_ENABLED` was not set to `true`
- Worker runtime state was not changed
- No onchain transaction
- No production data delete

## 29. Remaining rollout checks

These are pre-production checks. They are not code blockers.

- Browser verification at 1440px, 1024px, and 390px
- Supabase Auth redirect allow-list for `/auth/callback`
- A real human magic-link signup
- A real social write-path smoke test

`BIT_SOCIAL_PUBLISH_ENABLED` remains disabled.

## 30. Exact next command / gate

LIVE SOCIAL FOUNDATION VERIFICATION

Do not set `BIT_SOCIAL_PUBLISH_ENABLED=true`. Do not start `MACHINE ACCESS V1`.
