-- Canonical singleton runtime record for $BIT.
-- Public clients may read this row. They cannot insert, update, or delete it.

create table if not exists public.bit_runtime (
  id smallint primary key,
  canonical_mint text,
  launch_state text not null default 'PRELAUNCH',
  activation_timestamp timestamptz,
  launch_signature text,
  launch_slot bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bit_runtime_singleton check (id = 1),
  constraint bit_runtime_launch_state_check check (launch_state in ('PRELAUNCH', 'LIVE')),
  constraint bit_runtime_live_requires_mint check (
    launch_state <> 'LIVE' or canonical_mint is not null
  ),
  constraint bit_runtime_mint_format check (
    canonical_mint is null
    or canonical_mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  constraint bit_runtime_launch_slot_nonnegative check (
    launch_slot is null or launch_slot >= 0
  )
);

comment on table public.bit_runtime is
  'Single canonical BIT runtime row. Anon may select. Anon cannot write.';

create or replace function public.set_bit_runtime_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bit_runtime_set_updated_at on public.bit_runtime;

create trigger bit_runtime_set_updated_at
before update on public.bit_runtime
for each row
execute function public.set_bit_runtime_updated_at();

alter table public.bit_runtime enable row level security;

drop policy if exists bit_runtime_public_read on public.bit_runtime;

create policy bit_runtime_public_read
on public.bit_runtime
for select
to anon, authenticated
using (true);

revoke insert, update, delete on table public.bit_runtime from anon, authenticated;
grant select on table public.bit_runtime to anon, authenticated;

insert into public.bit_runtime (
  id,
  canonical_mint,
  launch_state,
  activation_timestamp,
  launch_signature,
  launch_slot
)
values (1, null, 'PRELAUNCH', null, null, null)
on conflict (id) do nothing;
