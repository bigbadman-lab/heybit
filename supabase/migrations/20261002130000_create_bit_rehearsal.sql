-- Isolated ten-minute rehearsal window.
-- Does not alter bit_runtime, processed_transactions, or bit_reactions.
-- Does not grant anon writes. Does not store secrets.
-- A row is effective only until expires_at. The permanent launch row stays untouched.

create table if not exists public.bit_rehearsal (
  id smallint primary key,
  mint text not null,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  stopped_at timestamptz,
  constraint bit_rehearsal_singleton check (id = 1),
  constraint bit_rehearsal_mint_format check (mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint bit_rehearsal_duration check (expires_at = started_at + interval '10 minutes'),
  constraint bit_rehearsal_stop_after_start check (stopped_at is null or stopped_at >= started_at)
);

comment on table public.bit_rehearsal is
  'Temporary rehearsal window. Anon may select. Anon cannot write. Not the canonical launch row.';

alter table public.bit_rehearsal enable row level security;

drop policy if exists bit_rehearsal_public_read on public.bit_rehearsal;

create policy bit_rehearsal_public_read
on public.bit_rehearsal
for select
to anon, authenticated
using (true);

revoke insert, update, delete on table public.bit_rehearsal from anon, authenticated;
grant select on table public.bit_rehearsal to anon, authenticated;
grant select, insert, update on table public.bit_rehearsal to service_role;
