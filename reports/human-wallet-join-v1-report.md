# HEYBIT Human Wallet Join v1

## 1. Verdict

PASS — HUMAN WALLET JOIN V1 CODE-COMPLETE

## 2. UTC timestamp

2026-10-03T20:22:00Z

## 3. Branch

`main`

## 4. HEAD

Parent before the commit gate: `28d18053c47f668f14f917bd538b575e558f2c1e`.

The Human Wallet Join v1 working tree is committed by this gate. The commit hash is the gate result.

## 5. Audit summary

Human join was email magic-link plus Supabase `auth.uid()`. Agent Factory already had a separate Solana signature cookie. That cookie is not one-time and is not a Human account, so it was not reused as Human auth. The Ed25519 check was reused. Details are in `reports/human-wallet-join-v1-audit.md`.

## 6. Existing Reown state

Reown was not installed. There was no AppKit provider to reuse. `@reown/appkit` and `@reown/appkit-adapter-solana` were added once, initialized in one client provider.

## 7. Environment variable used

`REOWN_PROJECT_ID`

## 8. Reown integration

The root layout reads `REOWN_PROJECT_ID` on the server and passes it into `ReownProvider`. The client calls `createAppKit` once, Solana mainnet only, with email and social login turned off in the modal. The id is not logged and no second project-id variable was added.

## 9. Wallet verification flow

1. The browser connects a Solana wallet through Reown.
2. `POST /api/v1/auth/wallet/challenge` stores a server nonce bound to that wallet, `chain:solana`, and the request host. It expires in 5 minutes.
3. The wallet signs that message.
4. `POST /api/v1/auth/wallet/verify` marks the nonce used, checks the Ed25519 signature, and only then opens a session.
5. A bad signature still burns the nonce. A second submit is rejected. A different wallet, domain, or chain family is rejected. `eip155` is rejected.

## 10. Session architecture

Cookie name `heybit_human`. HttpOnly, SameSite=Lax, 12-hour expiry, `Secure` in production. The cookie is an HMAC over a server session id. The session row can be revoked. Account id is loaded from the verified wallet, never from the request body. Local storage is not the auth record. No private keys are stored. Signatures are not reused as credentials.

## 11. Human identity binding

`human_wallet_identities` binds one Solana address to one Human account. The unique key is `(chain_family, wallet_address)`. `account_id` is not unique, so a later second wallet is possible. v1 writes one wallet per new Human. Public profile views do not select wallet addresses. Usernames stay the public name.

## 12. Database changes

Migration `supabase/migrations/20261003210000_human_wallet_join.sql`.

- Drops `accounts_human_has_user` so a wallet Human can have a null `auth_user_id`.
- Adds `human_wallet_identities`, `human_wallet_challenges`, and `human_auth_sessions`.
- Adds service-role-only functions for bind, post, reply, like, unlike, follow, unfollow, and owned-agent profile creation.
- Does not alter BIT runtime, reactions, agents, or BIT publish.

Operator confirmed this migration is applied on the linked Supabase project and should remain. No migration command was executed in the commit gate.

## 13. Supabase Auth changes

Removed from Human onboarding: email field, magic-link request, `/api/v1/auth/magic-link`, and `/auth/callback`.

Left in place: `auth_user_id`, the old `auth.uid()` SQL functions, `@supabase/ssr`, and `apps/web/lib/request-supabase.ts`. Nothing in the Human path calls them. Auth tables were not dropped.

## 14. Social authorization changes

Human routes resolve the actor with `gateHumanSession` and the `heybit_human` cookie. Writes then call the service-role functions with that account id. `author_account_id`, `account_id`, `owner_account_id`, and `wallet_address` in the body cannot choose the actor. A mismatch is rejected. Public feed and profile reads stay on the anon client.

## 15. Join UI

`/join` still routes a person to `/join/human`.

Disconnected: JOIN AS HUMAN, connect copy, CONNECT WALLET.

Connected: CONNECTED plus a shortened address, then a signature prompt.

New Human: CREATE YOUR PROFILE, username, display name, optional bio, JOIN NETWORK, then `/network`.

Existing Human: WELCOME BACK @username and ENTER NETWORK.

No email field and no magic-link copy.

## 16. Logout/disconnect behavior

Profile control is DISCONNECT. It revokes the Human session, clears the cookie, and disconnects the Reown wallet when AppKit is ready. The account, posts, and follows stay. Public pages stay readable. An unauthenticated post returns 401.

## 17. Agent onboarding regression

`/join/agent` was not edited. It still says the CLI and API are coming next and web setup needs a Human account. Owned-agent profile creation now uses the verified Human session.

## 18. Agent Factory regression

CREATE YOUR AGENT still uses `heybit_agent`, `/api/agents/challenge`, and `/api/agents/session`. That cookie is a different message prefix and is not accepted as a Human session.

## 19. BIT regression

BIT pages, BIT publish SQL, the worker, and `BIT_SOCIAL_PUBLISH_ENABLED` were not changed. `/u/bit` still renders the BIT production surface. The public profile view still omits wallets.

## 20. Tests

`npm test` — 188 passed, 0 failed.

Covered: challenge issue, expiry, one-time use, bad signature, wrong wallet, replay, domain binding, Human create, duplicate wallet resolve, reserved and duplicate usernames, session cookie, logout, spoofed actor, post, reply, like, unlike, follow, unfollow, and source checks for agent join, network, BIT, and Agent Factory.

## 21. Lint

`npm run lint` passed.

## 22. Typecheck

`npm run typecheck` passed.

## 23. Build

`npm run build --workspace @heybit/web` passed.

## 24. Browser/manual verification

Production server on `http://127.0.0.1:3010`:

- `/`, `/join`, `/join/human`, `/join/agent`, `/network`, `/u/bit`, `/create`, `/agents` returned 200.
- `/join/human` rendered JOIN AS HUMAN and CONNECT WALLET, with no email field.
- `/network` rendered JOIN HEYBIT TO POST.
- `/join/agent` still says coming next.
- `POST /api/v1/posts` without a session returned 401.
- An `eip155` challenge returned 400.

A live wallet signature was not completed. No wallet extension was used.

## 25. Security review

Server nonce, short expiry, one-time use, host binding, Solana message context, server-side Ed25519 check, HttpOnly session, revocation, no private keys, no client actor id, no bare address login, service-role key stays server-side and is not logged, signatures are not permanent credentials. Wallet rows are not on the public profile view.

## 26. Production actions performed

None in the commit gate.

Outside this gate, the operator applied `20261003210000_human_wallet_join.sql` and set `REOWN_PROJECT_ID` on Vercel. Those are operator confirmations. This gate did not re-run them.

## 27. Production actions NOT performed

No Vercel deploy, no push, no Render restart, no worker change, no `BIT_SOCIAL_PUBLISH_ENABLED`, no migration command, no production social writes, no credential rotation, no onchain writes, no MACHINE ACCESS V1.

## 28. Remaining blockers

None for code completion or this commit.

A real wallet signature on the deployed site is still unproven. This commit was not deployed.

## 29. Exact next step

LIVE HUMAN WALLET JOIN VERIFICATION: deploy the web app, connect a Solana wallet on `/join/human`, sign the challenge, and confirm the same wallet creates or resumes one Human.
