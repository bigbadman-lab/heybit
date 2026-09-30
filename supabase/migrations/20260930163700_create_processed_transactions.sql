-- Server-only ledger of observed transaction signatures.
-- Does not alter bit_runtime. No anon access. No AI text.

create table if not exists public.processed_transactions (
  signature text primary key,
  slot bigint,
  canonical_mint text not null,
  status text not null,
  event_type text,
  sol_amount numeric,
  token_amount numeric,
  observed_at timestamptz not null default now(),
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint processed_transactions_status_check check (status in ('trade', 'ignored', 'failed')),
  constraint processed_transactions_event_type_check check (
    event_type is null or event_type in ('BUY', 'SELL')
  ),
  constraint processed_transactions_trade_fields_check check (
    (
      status = 'trade'
      and event_type is not null
      and sol_amount is not null
    )
    or (
      status <> 'trade'
      and event_type is null
    )
  ),
  constraint processed_transactions_slot_nonnegative check (slot is null or slot >= 0)
);

comment on table public.processed_transactions is
  'Durable signature ledger for the worker. Unique signature prevents duplicate events. No public access.';

alter table public.processed_transactions enable row level security;

revoke all on table public.processed_transactions from anon, authenticated;
