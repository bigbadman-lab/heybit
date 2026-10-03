# Human wallet join v1 — environment

## Variable

`REOWN_PROJECT_ID`

## Purpose

Reown AppKit project id for Human wallet connect. The web server reads this name and passes it into the browser provider. WalletConnect needs the id in the client. It is public by design. It is not a server secret and it is not logged.

## Local

Required in the repo-root `.env.local` for `/join/human`. Blank placeholder is in `.env.example`. No value is stored in git.

## Vercel

Required on the web project. The operator confirmed `REOWN_PROJECT_ID` is set there. Do not also set a `NEXT_PUBLIC_` copy. The value is not recorded in this report.

## Render

Not required. The worker does not connect wallets.

## Classification

Public project id. Non-secret. Still do not commit a real value.

## Status

Existing. Already present in local operator env. Not newly invented.

The BIT env manifest was left unchanged. That file is scanned by BIT surface tests and must not name this client. `.env.example` is the documented placeholder.
