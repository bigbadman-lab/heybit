# HEYBIT Human Wallet Auth + Join UX Fix

## 1. Verdict
PASS — HUMAN WALLET AUTH + JOIN UX FIX CODE-COMPLETE

## 2. UTC timestamp
2026-10-03T20:52:45Z

## 3. Branch
main

## 4. HEAD
`fbc36eeb815c3ada34ea6aa8f8ff1d9379904c0f`

The repair is in the working tree. It is not committed.

## 5. Production symptoms
Wallet connection could start, but HEYBIT did not keep a Human session. VERIFY WALLET did not finish authentication, so `/network` stayed read-only. Human Join and the post-verify profile state stretched to the viewport.

## 6. Root cause(s)
Recorded in `reports/human-wallet-auth-ux-fix-audit.md`.

- Signatures that were not a raw `Uint8Array` were encoded as empty bytes, so verification rejected them.
- VERIFY WALLET was shown only after that error. A connect effect tried to sign immediately.
- The verify response did not put `Set-Cookie` on the response object, and the client never read a session resource.
- `.network-form { width: 100% }` overrode the factory column, so join fields became the full width of `main.home`.
- Host detection ignored the `Host` header and kept default ports `:443` and `:80`.
- Wallet routes were not pinned to the Node runtime.
- The env manifest listed the service-role key for local and Render only. Human challenge, session, and account resolution need that key on the Next.js server. Reown can still open from `REOWN_PROJECT_ID` alone.

## 7. Reown connection fix
The join screen reads AppKit’s Solana account. A usable Solana address shows `WALLET`, `● CONNECTED`, the shortened address, and `VERIFY WALLET`. Any other connected namespace shows “Connect a Solana wallet to join.” A restored AppKit session uses the same account state. There is no local boolean and no automatic signature prompt.

## 8. Verify Wallet fix
VERIFY WALLET is the action once a Solana account is connected. Each click requests a new challenge, signs that message, and submits the signature. A rejected or invalid attempt leaves the button in place. The next click issues a new challenge. The previous nonce stays single-use once the server accepts the attempt.

## 9. Signature verification path
`normalizeWalletSignature` accepts 64-byte `Uint8Array` values, number arrays, `ArrayBuffer`, base58, base64, and `{ signature }`. The server still checks Ed25519 over the stored challenge message with the wallet address. Address-only trust was not added. A bad signature still burns that nonce. Domain, expiry, and reuse failures stay distinct from a bad signature.

## 10. Session/cookie fix
Verify and sign-out set `heybit_human` on the response with `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age`, and `Secure` in production. There is no `Domain` attribute. A local production server returned that clear cookie on sign-out. Wallet routes set `runtime = "nodejs"`. Host selection is `x-forwarded-host`, then `Host`, then the request URL host, with `:443` and `:80` removed.

## 11. Client auth-state fix
After verify, the client reads `GET /api/v1/auth/wallet/session`. An account username goes to `/network` and the page refreshes. A verified wallet with no profile refreshes into CREATE PROFILE. Unauthenticated is `{ authenticated: false }`. The authenticated body is the account plus a shortened Solana address. Session ids are not returned. The header reads the same server session.

## 12. Network write-access fix
The composer, reply, like, and follow paths still require a ready Human session. Reown connected is not enough. An unauthenticated `POST /api/v1/posts` returned 401. The logged-out `/network` page shows JOIN HEYBIT TO POST.

## 13. Disconnect behavior
DISCONNECT revokes the session row, clears `heybit_human`, disconnects Reown, then returns home and refreshes. The account row is not deleted. The header control is `@username`, the shortened address, and DISCONNECT. A verified wallet with no username shows WALLET VERIFIED instead of an `@` handle.

## 14. Join layout fix
`/join/human` stays in `main.home.factory` and wraps the steps in `.join-panel`, whose width is `min(100% - 3rem, var(--bit-column))`. The form is 100% of that panel, not the viewport. Copy is JOIN / HUMAN, CONNECT A WALLET, then WALLET / CONNECTED / VERIFY WALLET, then CREATE PROFILE.

## 15. Authenticated layout fix
WELCOME BACK shows `@username`, ENTER NETWORK, and DISCONNECT inside the same panel. Creating a profile still navigates to `/network`. `/network` stays in `.network.network-page`. The header identity row sits under the existing header bar, at the same 40rem width, and wraps.

## 16. Responsive verification
No browser viewport pass was available. The column rules already used by the site are 27.5rem, 24rem at 1100px, and 16rem at 700px. The join panel uses that column with side margin. The header session row wraps, and its mobile padding matches the header. Rendered HTML for `/join/human` contains `join-panel` and does not contain `100vw`.

## 17. Agent join regression
`/join/agent` still uses `main.home.factory`, still says the CLI is coming next, and does not use `join-panel`. The page returned 200.

## 18. Agent Factory regression
`/create` still renders CreateAgent inside the factory shell. Agent challenge and `heybit_agent` were not changed. `/create` and `/agents` returned 200.

## 19. BIT regression
`/u/bit` still renders BitProduction. The homepage first-load JavaScript stayed about 121 kB. BIT social publishing was not enabled. `/` and `/u/bit` returned 200.

## 20. Tests
`npm test` — 190 passed, 0 failed.

Covered: signature shapes, a failed proof followed by a new challenge, cookie flags with no Domain, host and port normalization, explicit VERIFY WALLET, session route shape, Node runtime, join panel, agent join, and BIT source checks. Social write plans for post, reply, like, unlike, follow, and unfollow remain in the existing Human wallet tests.

## 21. Lint
`npm run lint` passed.

## 22. Typecheck
`npm run typecheck` passed.

## 23. Build
`npm run build --workspace @heybit/web` passed.

## 24. Manual/browser verification
Local `next start` on 127.0.0.1:3010:

- `/`, `/join`, `/join/human`, `/join/agent`, `/network`, `/u/bit`, `/create`, `/agents` returned 200
- `/join/human` showed JOIN / HUMAN and CONNECT A WALLET, and did not show VERIFY WALLET before a wallet was connected
- `GET /api/v1/auth/wallet/session` returned `{ authenticated: false }`
- unauthenticated post returned 401
- `eip155` challenge returned 400
- sign-out set `heybit_human` as HttpOnly, Secure, SameSite=Lax, Path=/, with no Domain

A real wallet signature was not performed. Desktop, tablet, and phone were not opened in a browser.

## 25. Production-specific findings
`REOWN_PROJECT_ID` is still read on the server and passed into the client. It is not a second variable and it was not printed. AppKit still starts in a client effect. Wallet routes are Node, not edge. The public host is taken from forwarded host, then Host. The session cookie is Secure in production and host-only.

The manifest now lists the service-role key for the Next.js server as well as local and Render. The key stays server-side. If Vercel does not have it, challenge and session lookup stay unavailable even after this repair. This gate did not read the Vercel dashboard.

## 26. Security review
Verification still requires a signed Solana challenge. Nonces stay single-use. Social writes still come from the session, not from a body wallet or account id. The service-role name is not sent to the browser. Cookies stay HttpOnly. No public write path was opened.

## 27. Production actions performed
None.

## 28. Production actions NOT performed
No deploy, no push, no commit, no migration, no Render restart, no `BIT_SOCIAL_PUBLISH_ENABLED`, no credential rotation, no production social writes, no onchain writes.

## 29. Remaining blockers
No code blocker.

Production still needs the existing server service-role key on Vercel if it is not already set. A live wallet round trip has not been done.

## 30. Exact next step
Confirm the server service-role key is set on Vercel, deploy this repair, then connect a Solana wallet on `/join/human`, click VERIFY WALLET, sign the challenge, and enter `/network`.
