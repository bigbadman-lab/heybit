# Metadata branding update

## 1. Verdict

PASS

## 2. UTC timestamp

2026-10-01T09:10:50Z

## 3. Branch

`main`

## 4. HEAD

`7038efc feat: complete BIT live homepage experience`

## 5. Working-tree status

Dirty and uncommitted. No commit. No push.

This change touched `apps/web/app/layout.tsx`, `package.json`, `scripts/metadata-branding.test.ts`, and this report.

Already untracked and left untouched: `apps/web/public/brand/bitmeta.jpg` and `reports/COMMIT-PHASE-5-BIT-HOMEPAGE.md`.

## 6. Exact path of bitmeta.jpg

`apps/web/public/brand/bitmeta.jpg`

Public URL: `/brand/bitmeta.jpg`

## 7. Exact path of bitmain2.png

`apps/web/public/brand/bitmain2.png`

Public URL: `/brand/bitmain2.png`

## 8. Files changed

- `apps/web/app/layout.tsx`
- `package.json`
- `scripts/metadata-branding.test.ts`
- `reports/METADATA-BRANDING-UPDATE.md`

Neither image was moved, resized, or regenerated.

## 9. OG metadata change

The root metadata now sets one `openGraph.images` entry: `/brand/bitmeta.jpg`. The homepage does not define a second Open Graph block. Rendered head on `/` includes `og:image` pointing at that file.

## 10. Twitter/X metadata change

The same root metadata sets `twitter.card` to `summary_large_image` and `twitter.images` to `/brand/bitmeta.jpg`. Rendered head includes `twitter:image` for that file.

## 11. Favicon change

`icons.icon` is `/brand/bitmain2.png`. Rendered head includes `<link rel="icon" href="/brand/bitmain2.png"/>`. There is no `app/icon.png` or `app/favicon.ico`.

## 12. Preserved metadata confirmation

Layout title and description are unchanged. Homepage title remains `HEYBIT` and description remains `BIT is waking up.` Rendered `og:title` and `twitter:title` follow that homepage title. No canonical, robots, theme, or viewport fields were added or removed.

## 13. Typecheck result

Pass.

## 14. Lint result

Pass.

## 15. Test result

Pass. 94 tests, 0 failures.

## 16. Build result

Pass. `/` remains 3.83 kB. Next.js warned that `metadataBase` is unset and used `http://localhost:3000` while generating static pages. No site URL was added.

## 17. Manual verification instructions

Dev server: http://localhost:3000/

On `/`, the tab icon is `/brand/bitmain2.png`. The head contains `og:image` and `twitter:image` for `/brand/bitmeta.jpg`, with card `summary_large_image`. Both asset URLs returned 200. The homepage layout was not changed.

## 18. Explicit confirmation

No deployment. No push. No commit. No Vercel or Render change. No Supabase write. No runtime change. No Solana write. No OpenAI or other AI call. No homepage UI or mascot behavior change.
