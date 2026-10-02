-- User-created token agents. Does not alter bit_runtime or the canonical BIT tables.
-- Base tables are not readable by anon. Public views omit wallets, ids, signatures, and prompts.

create table public.bit_agents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  token_mint text not null,
  personality text not null,
  avatar_key text not null,
  accent_key text not null,
  created_by_wallet text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bit_agents_name_length check (char_length(name) between 1 and 24),
  constraint bit_agents_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 1 and 40),
  constraint bit_agents_mint_shape check (token_mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint bit_agents_wallet_shape check (created_by_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint bit_agents_personality_check check (personality in ('DEADPAN', 'DEGEN', 'ANALYST', 'CHAOTIC', 'PARANOID', 'DRY')),
  constraint bit_agents_avatar_check check (avatar_key in ('mark', 'square', 'ring')),
  constraint bit_agents_accent_check check (accent_key in ('bone', 'acid', 'signal', 'ember')),
  constraint bit_agents_status_check check (status in ('ACTIVE', 'PAUSED'))
);

create index bit_agents_token_mint_idx on public.bit_agents (token_mint);
create index bit_agents_wallet_idx on public.bit_agents (created_by_wallet);
create index bit_agents_status_idx on public.bit_agents (status);

create table public.bit_agent_activity (
  id bigint generated always as identity primary key,
  agent_slug text not null references public.bit_agents (slug),
  event_type text not null,
  sol_amount numeric null,
  observed_at timestamptz not null,
  signature text not null,
  constraint bit_agent_activity_event_check check (event_type in ('BUY', 'SELL')),
  constraint bit_agent_activity_signature_unique unique (agent_slug, signature)
);

create index bit_agent_activity_slug_time_idx on public.bit_agent_activity (agent_slug, observed_at desc);

create table public.bit_agent_reactions (
  id bigint generated always as identity primary key,
  agent_slug text not null references public.bit_agents (slug),
  source_key text not null,
  status text not null,
  text text null,
  model text null,
  generated_at timestamptz null,
  constraint bit_agent_reactions_source_unique unique (agent_slug, source_key)
);

create index bit_agent_reactions_slug_time_idx on public.bit_agent_reactions (agent_slug, generated_at desc);

alter table public.bit_agents enable row level security;
alter table public.bit_agent_activity enable row level security;
alter table public.bit_agent_reactions enable row level security;

revoke all on table public.bit_agents from public, anon, authenticated;
revoke all on table public.bit_agent_activity from public, anon, authenticated;
revoke all on table public.bit_agent_reactions from public, anon, authenticated;

create or replace view public.bit_public_agents
with (security_invoker = false) as
select slug, name, token_mint, personality, avatar_key, accent_key, status, created_at
from public.bit_agents
where status = 'ACTIVE';

-- Separate from bit_public_agent_trades, which is the canonical BIT market view.
create or replace view public.bit_public_token_agent_trades
with (security_invoker = false) as
select agent_slug as slug, event_type, sol_amount, observed_at
from public.bit_agent_activity
where observed_at > now() - interval '15 minutes';

create or replace view public.bit_public_agent_lines
with (security_invoker = false) as
select agent_slug as slug, text, generated_at
from public.bit_agent_reactions
where status = 'GENERATED'
  and text is not null;

revoke all on table public.bit_public_agents from public, anon, authenticated;
revoke all on table public.bit_public_token_agent_trades from public, anon, authenticated;
revoke all on table public.bit_public_agent_lines from public, anon, authenticated;
grant select on table public.bit_public_agents to anon, authenticated;
grant select on table public.bit_public_token_agent_trades to anon, authenticated;
grant select on table public.bit_public_agent_lines to anon, authenticated;
