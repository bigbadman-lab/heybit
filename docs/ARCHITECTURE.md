# Architecture

The market pipeline below is the intended later shape. Phase 2 reads canonical runtime state only.

```text
Solana / Alchemy
      |
      v
Render worker
      |
      +--> deterministic event normalization
      |
      +--> OpenAI for short BIT personality text only
      |
      v
Supabase
      |
      v
Next.js / Vercel
```

## Responsibility split

Alchemy and onchain logic determine WHAT happened.

OpenAI determines HOW BIT talks about what happened.

OpenAI is not part of transaction classification.

The AI does not determine whether a transaction is a BUY or SELL.

`TOKEN_BURN` and `DEX_PAID` are operator actions. They are not inferred from market chatter.

## Runtime state

`public.bit_runtime` in Supabase is the canonical dynamic launch state. It is one singleton row, `id = 1`.

```text
web --------> reads bit_runtime
worker -----> reads bit_runtime
operator CLI > reads bit_runtime
```

Future authorized activation updates that same record. It does not update environment variables and it does not require a redeploy just to publish the official mint.

The official `$BIT` mint is stored once in `canonical_mint`. It is not copied into Vercel or Render environment variables.

Access:

- Row Level Security is enabled.
- `anon` and `authenticated` may `SELECT` the row.
- `anon` and `authenticated` cannot `INSERT`, `UPDATE`, or `DELETE`.
- Privileged server and operator reads use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- The browser never receives the service-role key.
- The web app reads with the anon key on the server.

`npm run supabase:check` is the read-only connectivity check for the service-role path and the anon path.

## Applications

- `apps/web` is the Next.js app. It server-renders the current runtime state. It is not the final site.
- `apps/worker` reads the same runtime row. Once the token is live it processes confirmed trades through a bounded queue, then a separate reaction scheduler may ask OpenAI for one short line. During `PRELAUNCH` both stay idle.
- `packages/shared` holds the event names, the canonical runtime contract, and the deterministic BUY/SELL parser.

## Trade monitoring

```text
Alchemy WSS callback
    |
    v
lightweight enqueue
    |
    v
bounded queue (capacity 2000, pause intake when full)
    |
    v
worker pool (concurrency 8)
    |
    v
confirmed tx fetch, with bounded retry
    |
    v
durable signature dedupe
    |
    v
deterministic parser
    |
    v
normalized BUY / SELL event
    |
    v
Supabase processed_transactions
```

The websocket callback only enqueues a signature. Eight processors do the fetch and the write. That limit is a code constant, not an environment toggle. If the queue reaches 2,000 waiting signatures, intake pauses and the socket reconnects when the queue falls to 500. Unique signatures are not dropped. The in-memory queue and the recent-signature cache (5,000 entries) are lost on restart. `processed_transactions` remains the authority for duplicates.

Processing may finish out of slot order. Each stored event keeps its slot. Downstream readers order by slot or time. Identity is the signature.

Temporary RPC timeouts, websocket reconnects, a transaction that is not yet fetchable, and temporary database errors retry at most three times, waiting 200ms, then 800ms, then 2s. Parser results, failed transactions, and unrelated mints are recorded once and are not retried. Commitment is `confirmed`.

The listener follows `bit_runtime`:

```text
PRELAUNCH -> listener IDLE
LIVE + canonical mint -> listener ACTIVE
```

There is no environment toggle and no redeploy for that change. The worker polls canonical runtime state every five seconds.

```text
deterministic events
    |
    v
aggregation windows
    |
    v
reaction scheduler
    |
    v
OpenAI
    |
    v
validated BIT reaction
    |
    v
bit_reactions
```

Every confirmed trade can be stored. Not every trade gets a reaction. Normal windows are 8 seconds. Low activity may describe one trade. Heavier windows become one burst summary. The scheduler keeps one pending normal summary, waits at least 5 seconds between ordinary lines, and waits longer when activity is high or very high. Normal summaries older than 30 seconds expire. `TOKEN_BURN` and `DEX_PAID` are priority inputs and are not discarded by that expiry. OpenAI concurrency is 1. The model name is `gpt-6-luna`.

## Future reliability requirements

These remain outside this phase.

- Production website
- Production worker deployment
- Burn execution
- DEX-paid mutation
- Token activation
