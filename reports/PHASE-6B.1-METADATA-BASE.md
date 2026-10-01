# Phase 6B.1 — Production metadata base

## 1. Verdict

PASS

## 2. UTC timestamp

2026-10-01T10:32:57Z

## 3. Branch

`main`

## 4. HEAD

`5c789c9250517764fefba37f39bc7b6ef47d028c` — feat: add public token links for a live mint

## 5. Working-tree status

Not committed. Not pushed.

```text
 M apps/web/app/layout.tsx
 M scripts/metadata-branding.test.ts
?? reports/PHASE-6B-PUBLIC-TOKEN-ACTIONS.md
?? reports/PHASE-6B.1-METADATA-BASE.md
```

`reports/PHASE-6B-PUBLIC-TOKEN-ACTIONS.md` was already untracked before this phase and was not edited.

## 6. Files changed

- `apps/web/app/layout.tsx` — sets `metadataBase`
- `scripts/metadata-branding.test.ts` — checks the production base, image paths, favicon, and the absence of a site-url env flag
- `reports/PHASE-6B.1-METADATA-BASE.md` — this report

## 7. Canonical production domain

`https://heybit.fun`

## 8. Metadata source updated

`apps/web/app/layout.tsx`, the existing root `metadata` export. No second metadata source was added. Homepage title and description were left on `apps/web/app/page.tsx`.

## 9. metadataBase implementation

```ts
metadataBase: new URL("https://heybit.fun")
```

Open Graph and Twitter images stay as the relative path `/brand/bitmeta.jpg`.

## 10. Effective OG image URL

Rendered on `/`:

```text
https://heybit.fun/brand/bitmeta.jpg
```

## 11. Effective Twitter/X image URL

Rendered on `/`:

```text
https://heybit.fun/brand/bitmeta.jpg
```

Card type remains `summary_large_image`.

## 12. Favicon confirmation

The icon link is still `/brand/bitmain2.png`. `bitmain.png` was not restored. No `app/icon.png` or `app/favicon.ico` was added.

## 13. Confirmation no new site-url env var was added

`NEXT_PUBLIC_SITE_URL`, `SITE_URL`, and `METADATA_BASE_URL` are absent from the layout and from `config/env-manifest.json`.

## 14. Typecheck result

Pass. `npm run typecheck` exited 0.

## 15. Lint result

Pass. `npm run lint` exited 0.

## 16. Test result

Pass. `npm test` — 100 passed, 0 failed.

## 17. Build result

Pass. `npm run build` exited 0. `/` is 4.32 kB, first load 112 kB. `/lab/bit` is 1.3 kB, first load 109 kB. Routes are unchanged: `/`, `/_not-found`, `/api/bit-visual`, `/lab/bit`.

## 18. Confirmation metadataBase warning is gone

The build no longer prints `metadataBase is not set`. No replacement metadata warning appeared.

## 19. Manual verification instructions

The local app is on `http://localhost:3000`.

View source on `/` and confirm:

- `og:image` is `https://heybit.fun/brand/bitmeta.jpg`
- `twitter:image` is the same URL
- `twitter:card` is `summary_large_image`
- the icon is `/brand/bitmain2.png`
- the visible page still shows RUNTIME PRELAUNCH, MINT NOT LAUNCHED, MARKET NOT LIVE, and no SOLSCAN or COPY MINT control

## 20. Remaining concerns

The favicon href stays a root-relative path, which is what the browser uses on the current host. Social images are the ones resolved through `metadataBase`. Nothing was deployed, so production HTML will pick this up on the next deploy.

## 21. Explicit confirmation

No deployment, no push, no commit, no Vercel change, no Render change, no Supabase write, no runtime write, no Solana write, no token activation, and no OpenAI or other AI call occurred.
