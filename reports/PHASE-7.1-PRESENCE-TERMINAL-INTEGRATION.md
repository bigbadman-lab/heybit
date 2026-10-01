# Phase 7.1 — Presence + terminal integration

## 1. Verdict

AWAITING VISUAL APPROVAL

## 2. UTC timestamp

2026-10-01T11:50:31Z

## 3. Branch

`main`

## 4. HEAD

`c745691123b6f95b45df34135cf214bbafbdf053` — fix: finalize public token metadata

## 5. Initial working-tree status

Phase 7.1 started from the uncommitted Phase 7 reset on `main`. HEAD was already `c745691`. The dirty tree was only that reset plus `reports/PHASE-7-RESET-LIVING-BIT.md`. No unrelated files were present. Nothing was committed or pushed.

## 6. Files changed

This pass only retuned presentation and the two tests that named the old column width:

- `apps/web/app/globals.css`
- `scripts/bit-composition.test.ts`
- `scripts/bit-terminal.test.ts`

The Phase 7 reset files remain uncommitted and were not restructured:

- `apps/web/app/page.tsx`
- `apps/web/components/bit/BitEventTape.tsx`
- `apps/web/components/bit/BitStatus.tsx`
- `apps/web/components/bit/bit-tape.ts`
- `apps/web/components/bit/BitPrompt.tsx`
- `apps/web/components/bit/BitSpeech.tsx`
- `apps/web/components/bit/bit-terminal.ts`
- `package.json`
- `scripts/bit-commentary.test.ts`
- `scripts/bit-market.test.ts`
- `scripts/bit-reaction-context.test.ts`
- `scripts/bit-tape.test.ts`
- `reports/PHASE-7-RESET-LIVING-BIT.md`

## 7. BIT scale / presence changes

Presence comes from stage size only. Geometry, eye shape, camera, halo, reaction timing, fallback asset, and production transparency are unchanged.

`--bit-column` on `main.home`:

| viewport | before | after | stage |
| --- | --- | --- | --- |
| desktop (>1100px) | 22rem / 352px | 27.5rem / 440px | +25% |
| tablet (≤1100px) | 20rem / 320px | 24rem / 384px | +20% |
| mobile (≤700px) | 16rem / 256px | 16rem / 256px | unchanged |

The stage stays a square of the column. BIT stays centered in that stage. The column is still inside `max-width: 40rem`, so the page does not return to the rejected wide layout.

## 8. HEYBIT placement changes

HEYBIT stays the small left-aligned identity line (`0.68rem`, muted). The gap under it is now `--bit-md` (1.15rem / 18px measured) instead of `clamp(1.75rem, 6vh, 3.5rem)`. It shares the terminal column edge. It is not a nav bar and not a logo lockup.

## 9. Speech presentation changes

The phrase is still the `h1` from the existing pools, with the existing fade. No quotes, bubbles, or generated lines.

- size `1.45rem` → `1.2rem` (`1.12rem` at ≤700px)
- weight `450` → `400`
- line-height `1.35` → `1.45`
- margin above the line `2.1rem` → `--bit-sm` (0.75rem)
- left aligned to the column

## 10. Activity-ledger spacing changes

The ledger stays the same shared feed. Empty copy is still `no activity.`

- top margin `2.6rem` → `--bit-lg` (1.7rem)
- padding under the rule `--bit-md`
- type `0.78rem`, line-height `1.45`
- row padding `0.22rem` → `--bit-xs` (0.4rem), baselines aligned, no per-row rules
- the empty note uses line-height `1.5` and sits in the padding under the rule

## 11. System-fact spacing changes

Order and values are unchanged: RUNTIME, MARKET, MINT, FEED.

- block margin `2.2rem` plus a second rule → `--bit-md`, no rule
- row padding `0.22rem` → `--bit-xs`
- type `0.75rem`, line-height `1.45`
- labels quieter (`rgba(..., 0.5)`, tracking `0.06em`)
- values stay muted grey, quieter than speech

## 12. Prompt spacing changes

The prompt is still `> waiting.` or `> observing.` plus a decorative cursor. It is not an input.

- margin `2.4rem` → `--bit-md`
- type `0.82rem`, line-height `1.45`
- cursor offset `--bit-xs`
- blink stays `1.1s steps(1)` and only under `prefers-reduced-motion: no-preference`

## 13. Separator changes

One primary rule remains: the hairline on `.bit-tape`, with `--bit-md` of padding beneath it.

Removed:

- the second rule on `.bit-status-block`
- the per-row rules on `.bit-tape-row`
- the per-row rules on `.bit-status div`

No panels, cards, or new borders.

## 14. Spacing system used

On `main.home`:

```text
--bit-xs  0.4rem
--bit-sm  0.75rem
--bit-md  1.15rem
--bit-lg  1.7rem
--bit-xl  2.4rem
```

Used for page padding, HEYBIT→BIT, speech, the ledger, facts, the prompt, row padding, and the cursor offset. Mobile only tightens page padding (`--bit-md` top, `--bit-lg` bottom).

## 15. Line-height decisions

Speech, activity, facts, and the prompt share `1.45`. The empty activity note uses `1.5`. Speech is allowed to wrap; the sampled phrase happened to fit on one line at all three widths.

## 16. Final desktop composition measurements

1440×900, headless, no horizontal overflow. Page height 966px (107vh). Column left edge 500px, width 440px for eyebrow, stage, reaction, speech, ledger, and prompt.

| piece | box |
| --- | --- |
| HEYBIT | y 27–44 |
| stage | 440×440, y 62–502 |
| reaction slot | y 502–518 |
| speech | “timeline is suspiciously calm”, y 531–559 |
| activity | “no activity.”, y 586–624 |
| facts | RUNTIME PRELAUNCH, MARKET NOT LIVE, MINT NOT LAUNCHED, FEED LIVE |
| prompt | “> waiting._”, cursor `aria-hidden="true"`, y 781–800 |

No Solscan link, wallet, or rejected section headings. No WebGL canvas in this headless session, so the mascot drawing itself was not seen.

## 17. Final tablet composition measurements

1024×800. Page height 866px (108vh). No overflow. Stage 384×384, y 62–446. Same phrase, facts, empty ledger, and `> waiting._`. Column width 384px, left edge 320px.

## 18. Final mobile composition measurements

390×844. `scrollWidth` 390. Page height 890px (105vh). Stage stays 256×256. Speech stayed one line at this phrase and size. Facts and the prompt share the 256px column. No overflow.

`/lab/bit` has no speech, reaction context, ledger, facts, or prompt.

## 19. Accessibility result

Speech remains the `h1`. Activity remains a labelled section. Facts remain `dt` / `dd`. The cursor stays `aria-hidden`. Token-action focus styles were not changed. Mobile speech is `1.12rem` with line-height `1.45`.

## 20. Performance impact

CSS only. Homepage bundle stayed 4.58 kB. First-load JS stayed 113 kB. No new fetch, route, or client module.

## 21. Typecheck result

Pass.

## 22. Lint result

Pass.

## 23. Test result

102 pass, 0 fail. Column assertions now expect `27.5rem` and `24rem`. Mobile `16rem` is unchanged. The suite still rejects the Phase 7A sections and the `72rem` container.

## 24. Build result

`npm run build -w @heybit/web` passed. No `metadataBase` warning.

Routes: `/`, `/_not-found`, `/api/bit-visual`, `/lab/bit`.

## 25. Build-size result

| route | size | first load |
| --- | --- | --- |
| `/` | 4.58 kB | 113 kB |
| `/lab/bit` | 1.3 kB | 109 kB |
| `/api/bit-visual` | 122 B | 103 kB |

Shared first-load JS 103 kB.

## 26. Remaining visual concerns

This is not a visual approval. Headless Chrome did not draw the WebGL mascot, so the larger stage was measured as a box, not as the rendered character. The sampled phrase did not wrap, so multi-line speech still needs a look on a normal display. Uppercase fact labels still read more like system metadata than spoken lines. The empty ledger is one short line, so the stream is quiet until real events arrive.

## 27. Explicit confirmation

No deployment. No push. No commit. No Vercel, Render, or Supabase changes. No environment writes. No `bit_runtime` writes. No Solana writes. No token activation. No OpenAI calls. No wallet, trading UI, Pump.fun link, fake events, new sections, or Phase 7A restoration.
