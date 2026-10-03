# Human wallet auth + join UX audit

UTC: 2026-10-03T20:40:00Z

This audit was written from the committed Human wallet join path before the repair. It names the failure points that match the deployed symptoms.

## Symptoms

1. Reown connection starts, but HEYBIT does not treat the Human as authenticated.
2. VERIFY WALLET does not finish authentication, so `/network` stays read-only.
3. Human Join and the post-verify profile state expand to the viewport instead of the HEYBIT column.

## Failure 1 — signature bytes are discarded

`apps/web/components/network/HumanJoin.tsx` calls `provider.signMessage` and then:

```ts
encodeBase58(signed instanceof Uint8Array ? signed : new Uint8Array())
```

AppKit Solana providers do not all return a raw `Uint8Array`. Wallet Standard returns signature bytes. WalletConnect returns decoded bytes. Other adapters and the wallet-standard result object return a base58 string, a base64 string, a byte array, or `{ signature }`. Any of those shapes is encoded as an empty byte string. The server then rejects the proof. Every click fails the same way.

The verifier itself (`walletSignatureValid`) still requires a 64-byte Ed25519 signature over the stored challenge message. That check is correct and must stay.

## Failure 2 — verify is automatic, and the button only appears after an error

A `useEffect` signs as soon as a Solana address and provider exist. The visible `VERIFY WALLET` control is rendered only when `error` is already set. That is the opposite of the required state machine: show CONNECTED, then let the person click VERIFY WALLET.

The effect also burns a nonce when the encoded signature is empty, because `consumeHumanChallenge` marks the row used before `acceptHumanProof` checks the signature. A rejected or malformed attempt cannot reuse that nonce. The next click does request a new challenge, but it encodes the signature the same way, so the person stays on the error button.

## Failure 3 — the session cookie is not the response the browser stores

`writeHumanCookie` calls `cookies().set`, then the route returns a separate `Response.json()`. The browser only becomes authenticated if that `Set-Cookie` is on the verify response. The client then calls `router.refresh()` and never reads a session resource. If the cookie is missing, refresh renders the anonymous join screen again. Reown can still look connected. HEYBIT does not.

Cookie flags that do exist are otherwise right for this app: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when `NODE_ENV` is production, no `Domain`.

## Failure 4 — join fields inherit a full-width form rule

`main.home` is a full-width column. `.factory-form` is `min(100%, var(--bit-column))`. Human join and the profile form use both `factory-form` and `network-form`. The later rule `.network-form { width: 100% }` wins, so the form becomes 100% of the viewport. `/network` does not show this because its form sits inside `.network` (`min(100% - 2rem, 40rem)`).

## Failure 5 — host binding can disagree on Vercel

`requestDomain` uses `x-forwarded-host`, then `request.url` host. It ignores the `Host` header. On Vercel, `request.url` can be the deployment host while the browser is on the public host. If one of the two requests lacks `x-forwarded-host`, the stored domain and the verify domain differ. The nonce is not consumed in that case, but the route reports it as “signature was not accepted,” so the person cannot tell the check failed on the host.

Default ports (`:443`, `:80`) are also kept, so `heybit.fun` and `heybit.fun:443` would not match.

## Failure 6 — wallet routes are not pinned to Node

Challenge and verify use `node:crypto` through the Human wallet module. The routes set `dynamic = "force-dynamic"` and do not set `runtime`. The Next.js default is Node, but an edge runtime would fail crypto and the service-role client.

## Failure 7 — the server key is not a documented Vercel variable

`serverAdminClient()` needs `NEXT_PUBLIC_SUPABASE_URL` (present on Vercel in the manifest) and the service-role key. `config/env-manifest.json` lists that key for local and Render only. Challenge insert, session open, and session read all return unavailable without it. Reown can still open, because `REOWN_PROJECT_ID` is a different variable and is already set on Vercel. This audit does not read dashboard values and does not print the key. If Vercel was filled only from the manifest plus the Reown id, production verify cannot create a session.

## What is not the bug

- Public `/network` reads stay anonymous. That is intended.
- Reown `isConnected` is not HEYBIT authentication. The composer already requires `session.status === "ready"` and `accountType === "HUMAN"`.
- Agent Factory still uses `heybit_agent`. It is a separate cookie.
- Signature verification, single-use nonces, and service-role-only writes should stay.
