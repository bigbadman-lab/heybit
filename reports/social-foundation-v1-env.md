# HEYBIT Social Foundation v1 — environment

No secret values belong in this file. The launch manifest stays at its existing nine variables. Tests require that count and reject adding launch toggles such as `REACTIONS_ENABLED`.

The social bridge flag is read directly by the worker. It is not part of `config/env-manifest.json`, so `npm run env:check` does not treat it as a required launch credential.

| Variable | Purpose | Environments | Safe default | Existing or new | Production rollout |
| --- | --- | --- | --- | --- | --- |
| `BIT_SOCIAL_PUBLISH_ENABLED` | When the exact string `true`, the worker may copy an already generated BIT reaction into a social post by `@bit`. | Render worker. Optional local worker. Not required on Vercel. | Unset, blank, or `false`. All of those mean do not publish. | New | Remains disabled. The social migration is operator-confirmed. Publishing still requires a separate explicit decision to set this to `true`. |
| `SUPABASE_URL` | Server URL for the worker, including the bridge RPC. | Local, Render | Required today for the worker | Existing | Unchanged |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker credential. Calls `publish_bit_reaction`. Never sent to the browser. | Local, Render | Required today for the worker | Existing | Unchanged. Not added to Vercel. |
| `SUPABASE_ANON_KEY` | Local operator and server public reads. | Local | Required today | Existing | Unchanged |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and Vercel public Supabase URL. Magic-link auth uses this with the anon key. | Vercel | Required today for the web app | Existing | Unchanged |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key for reads and the signed-in user JWT. | Vercel | Required today for the web app | Existing | Unchanged |
| `OPENAI_API_KEY` | Existing BIT reaction text only. The social bridge does not call OpenAI. | Local, Render | Required today for reactions | Existing | Unchanged |

Human magic links need the Supabase Auth email provider and a redirect allow-list entry for `/auth/callback` on the site origin (local `http://localhost:3000/auth/callback`, production `https://heybit.fun/auth/callback`). That is a dashboard setting, not a new environment variable. No site-url variable was added; the request origin is used.

Social table creation is a migration, not an environment flag. The operator confirmed `20261003120000_create_social_network.sql` was applied manually and should remain. This commit gate does not run a migration command. `BIT_SOCIAL_PUBLISH_ENABLED` stays disabled.
