-- Server-only BIT reaction lines.
-- Does not alter bit_runtime or processed_transactions.
-- No anon access. No prompts. No credentials.

create table if not exists public.bit_reactions (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  reaction_type text not null,
  source_mode text not null,
  source_window_start timestamptz,
  source_window_end timestamptz,
  source_event_count integer not null default 0,
  activity_level text,
  text text,
  model text,
  status text not null,
  created_at timestamptz not null default now(),
  generated_at timestamptz,
  constraint bit_reactions_type_check check (reaction_type in ('ACTIVITY', 'TOKEN_BURN', 'DEX_PAID')),
  constraint bit_reactions_mode_check check (source_mode in ('INDIVIDUAL', 'BURST', 'PRIORITY')),
  constraint bit_reactions_activity_check check (
    activity_level is null or activity_level in ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH')
  ),
  constraint bit_reactions_status_check check (status in ('PENDING', 'GENERATED', 'FAILED', 'EXPIRED')),
  constraint bit_reactions_event_count_check check (source_event_count >= 0),
  constraint bit_reactions_generated_text_check check (
    status <> 'GENERATED' or (text is not null and char_length(text) <= 120)
  )
);

comment on table public.bit_reactions is
  'Idempotent BIT reaction lines. source_key prevents duplicate reactions for the same window or priority event.';

alter table public.bit_reactions enable row level security;

revoke all on table public.bit_reactions from anon, authenticated;
